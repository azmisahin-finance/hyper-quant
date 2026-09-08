import { createHash } from 'node:crypto';
import { ResearchTrialLedger, type ResearchTrialOutcome, type ResearchTrialReceipt } from './trial-ledger.js';
import { deriveDependencyManifest, enforceDeclaredLookback, type FeatureNode } from './dependency.js';
import { assertArtifactIdentity, type ArtifactIdentityChain } from './artifact-identity.js';
import { validateStatisticalEvidence, type StatisticalDecision, type StatisticalPolicy } from './statistics.js';
import { HoldoutLedger, type HoldoutEvaluationInput } from './holdout-ledger.js';
import { computeDeflatedSharpeRatio } from './dsr.js';
import type { WalkForwardFold } from './walk-forward.js';
import type { CsCvResult } from './overfitting.js';
import type { RegimeCoverageReport } from './regimes.js';

export type ResearchPolicy = StatisticalPolicy & {
  minEffectiveOosOpportunities: number;
  maxPbo: number;
  maxSingleBlockPnlShare: number;
  maxSingleWeekPnlShare: number;
  minDistinctRegimes: number;
  minCostStressMultiplier: number;
};

export type ResearchEvidence = {
  effectiveOosOpportunities: number;
  walkForward: { folds: readonly WalkForwardFold[]; effectiveOosOpportunities: number };
  pboCscv: Pick<CsCvResult, 'pbo' | 'combinationsEvaluated'>;
  regimeCoverage: Pick<RegimeCoverageReport, 'distinctRegimes'>;
  pbo: number;
  contiguousBlockNetReturns: readonly number[];
  calendarWeekNetReturns: readonly number[];
  regimeIds: readonly string[];
  stressedNetExpectancy: number;
  statistical: StatisticalEvidenceInput;
  selectedReturns: readonly number[];
  dsrResult?: { method: 'CLASSIC_DSR_LS'; sampleCount: number; committedTrialCount: number; dsr: number };
};

type StatisticalEvidenceInput = {
  meanTradeExpectancy: number;
  sampleCount: number;
  sampleStdDev: number;
  dsr: number;
};

export type ResearchRunSpec = {
  receipt: ResearchTrialReceipt;
  featureNodes: readonly FeatureNode[];
  declaredLookback: number;
  artifactExpected: ArtifactIdentityChain;
  artifactExecuted: ArtifactIdentityChain;
  holdout: boolean;
  holdoutEvaluation?: HoldoutEvaluationInput;
};

export type ResearchRunResult<T> = {
  value: T;
  outcome: ResearchTrialOutcome['outcome'];
  trialCountAtCompletion: number;
  evidenceDecision: StatisticalDecision;
  evidenceHash: string;
};

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`INVALID_${name}`);
}

function maxShare(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + Math.abs(value), 0);
  if (total === 0) return 0;
  return Math.max(...values.map((value) => Math.abs(value))) / total;
}

function validateResearchEvidence(evidence: ResearchEvidence, policy: ResearchPolicy, committedTrialCount: number): StatisticalDecision {
  if (evidence.walkForward.effectiveOosOpportunities !== evidence.effectiveOosOpportunities) throw new Error('OOS_EVIDENCE_MISMATCH');
  if (evidence.walkForward.folds.length < 2) throw new Error('INSUFFICIENT_WALK_FORWARD_FOLDS');
  if (!Number.isInteger(evidence.effectiveOosOpportunities) || evidence.effectiveOosOpportunities < policy.minEffectiveOosOpportunities) {
    return { pass: false, reason: 'INSUFFICIENT_SAMPLE' };
  }
  if (evidence.pboCscv.combinationsEvaluated < 1 || !Number.isFinite(evidence.pboCscv.pbo) || evidence.pboCscv.pbo >= policy.maxPbo) throw new Error('PBO_GATE_FAILED');
  if (evidence.pbo !== evidence.pboCscv.pbo) throw new Error('PBO_EVIDENCE_MISMATCH');
  if (maxShare(evidence.contiguousBlockNetReturns) > policy.maxSingleBlockPnlShare) throw new Error('BLOCK_PNL_CONCENTRATION_FAILED');
  if (maxShare(evidence.calendarWeekNetReturns) > policy.maxSingleWeekPnlShare) throw new Error('WEEK_PNL_CONCENTRATION_FAILED');
  const distinctRegimes = evidence.regimeCoverage.distinctRegimes;
  if (distinctRegimes !== new Set(evidence.regimeIds).size) throw new Error('REGIME_EVIDENCE_MISMATCH');
  if (distinctRegimes < policy.minDistinctRegimes) throw new Error('REGIME_COVERAGE_FAILED');
  if (!Number.isFinite(evidence.stressedNetExpectancy) || evidence.stressedNetExpectancy <= 0) throw new Error('COST_STRESS_FAILED');
  if (evidence.selectedReturns.length !== evidence.statistical.sampleCount) throw new Error('DSR_SAMPLE_COUNT_MISMATCH');
  const computedDsr = computeDeflatedSharpeRatio({ returns: evidence.selectedReturns, committedTrialCount });
  if (!evidence.dsrResult) throw new Error('DSR_COMPUTED_EVIDENCE_REQUIRED');
  if (evidence.dsrResult.committedTrialCount !== committedTrialCount) throw new Error('DSR_TRIAL_COUNT_MISMATCH');
  if (evidence.dsrResult.sampleCount !== computedDsr.sampleCount) throw new Error('DSR_SAMPLE_COUNT_MISMATCH');
  if (evidence.dsrResult.method !== computedDsr.method) throw new Error('DSR_METHOD_MISMATCH');
  if (Math.abs(evidence.dsrResult.dsr - computedDsr.dsr) > 1e-12) throw new Error('DSR_EVIDENCE_MISMATCH');
  if (Math.abs(evidence.statistical.dsr - computedDsr.dsr) > 1e-12) throw new Error('DSR_STATISTICAL_MISMATCH');
  const statistical = { ...evidence.statistical, declaredTrialCount: committedTrialCount };
  return validateStatisticalEvidence(statistical, policy);
}

export function validateResearchEvidenceForPromotion(evidence: ResearchEvidence, policy: ResearchPolicy, committedTrialCount: number): StatisticalDecision {
  if (!Number.isInteger(committedTrialCount) || committedTrialCount < 1) return { pass: false, reason: 'INVALID_TRIAL_COUNT' };
  return validateResearchEvidence(evidence, policy, committedTrialCount);
}

export class ResearchRunner {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly ledger: ResearchTrialLedger, private readonly policy: ResearchPolicy, private readonly holdoutLedger?: HoldoutLedger) {}

  async run<T>(spec: ResearchRunSpec, compute: () => Promise<{ value: T; evidence: ResearchEvidence }>): Promise<ResearchRunResult<T>> {
    const operation = this.queue.then(async () => {
      this.validatePreconditions(spec);
      await this.ledger.registerBeforeRun(spec.receipt);
      let holdoutReservationId: string | undefined;
      if (spec.holdout) {
        if (!this.holdoutLedger || !spec.holdoutEvaluation) throw new Error('HOLDOUT_LEDGER_REQUIRED');
        holdoutReservationId = `holdout:${spec.receipt.trialId}`;
        await this.holdoutLedger.reserve(spec.holdoutEvaluation, holdoutReservationId);
      }
      let outcome: ResearchTrialOutcome['outcome'] = 'CRASHED';
      let terminalRecorded = false;
      try {
        const computed = await compute();
        const trialCount = await this.ledger.countRegisteredTrials(spec.receipt.researchProgramId);
        let decision: StatisticalDecision;
        try {
          decision = validateResearchEvidenceForPromotion(computed.evidence, this.policy, trialCount);
        } catch (gateError) {
          await this.ledger.recordOutcome({ ...spec.receipt, outcome: 'FAIL', completedAt: new Date().toISOString() });
          terminalRecorded = true;
          if (holdoutReservationId) await this.holdoutLedger!.finalizeReservation(holdoutReservationId, 'FAIL');
          throw gateError;
        }
        outcome = decision.pass ? 'PASS' : 'FAIL';
        if (holdoutReservationId) await this.holdoutLedger!.finalizeReservation(holdoutReservationId, outcome === 'PASS' ? 'PASS' : 'FAIL');
        const evidenceHash = createHash('sha256').update(JSON.stringify({ receipt: spec.receipt, evidence: computed.evidence, trialCount, decision })).digest('hex');
        await this.ledger.recordOutcome({ ...spec.receipt, outcome, completedAt: new Date().toISOString() });
        terminalRecorded = true;
        return { value: computed.value, outcome, trialCountAtCompletion: trialCount, evidenceDecision: decision, evidenceHash };
      } catch (error) {
        if (outcome === 'CRASHED' && !terminalRecorded) {
          await this.ledger.recordOutcome({ ...spec.receipt, outcome: 'CRASHED', completedAt: new Date().toISOString() });
          if (holdoutReservationId) await this.holdoutLedger!.finalizeReservation(holdoutReservationId, 'INCONCLUSIVE');
        }
        throw error;
      }
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private validatePreconditions(spec: ResearchRunSpec): void {
    const manifest = deriveDependencyManifest(spec.featureNodes);
    enforceDeclaredLookback(spec.declaredLookback, manifest);
    assertArtifactIdentity(spec.artifactExpected, spec.artifactExecuted);
    if (spec.holdout && !spec.receipt.selectionPolicyHash) throw new Error('HOLDOUT_SELECTION_POLICY_REQUIRED');
    assertPositiveFinite('MIN_OOS_OPPORTUNITIES', this.policy.minEffectiveOosOpportunities);
    if (!Number.isFinite(this.policy.maxPbo) || this.policy.maxPbo <= 0 || this.policy.maxPbo > 1) throw new Error('INVALID_MAX_PBO');
  }
}
