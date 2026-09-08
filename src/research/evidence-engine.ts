import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { computeDeflatedSharpeRatio, type DsrResult } from './dsr.js';
import { computeProbabilisticSharpeRatio, type PsrResult } from './psr.js';
import { type CampaignFinalRecord } from './campaign-ledger.js';
import { type HoldoutEvidence } from './controlled-holdout.js';
import { type CsCvResult } from './overfitting.js';
import { type RegimeCoverageReport, type RegimeSegment } from './regimes.js';
import { validateResearchEvidenceForPromotion, type ResearchEvidence, type ResearchPolicy } from './research-runner.js';
import type { WalkForwardFold } from './walk-forward.js';

export type ResearchEvidenceEngineInput = {
  campaign: CampaignFinalRecord;
  holdout: HoldoutEvidence;
  selectedReturns: readonly number[];
  committedTrialCount: number;
  walkForward: { folds: readonly WalkForwardFold[]; effectiveOosOpportunities: number };
  pboCscv: Pick<CsCvResult, 'pbo' | 'combinationsEvaluated'>;
  regimeCoverage: Pick<RegimeCoverageReport, 'distinctRegimes'>;
  regimeIds: readonly string[];
  contiguousBlockNetReturns: readonly number[];
  calendarWeekNetReturns: readonly number[];
  stressedNetExpectancy: number;
  statistical: ResearchEvidence['statistical'];
  benchmarkSharpe?: number;
};

export type FullResearchEvidencePackage = {
  schemaVersion: 'v2.9-full-research-evidence-v1';
  campaignId: string;
  researchProgramId: string;
  candidateId: string;
  selectionPolicyHash: string;
  selectionEvidenceHash: string;
  holdoutEvidenceHash: string;
  holdoutDatasetHash: string;
  selectedReturnsHash: string;
  committedTrialCount: number;
  pbo: number;
  dsr: DsrResult;
  psr: PsrResult;
  walkForward: { foldCount: number; effectiveOosOpportunities: number; testIndexHash: string };
  regimeCoverage: { distinctRegimes: number; regimeIds: readonly string[] };
  costStressNetExpectancy: number;
  statisticalDecision: ReturnType<typeof validateResearchEvidenceForPromotion>;
  evidenceHash: string;
};

export type EvidenceLedgerRecord = FullResearchEvidencePackage & { kind: 'FULL_RESEARCH_EVIDENCE'; recordedAt: string };

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalTestIndices(folds: readonly WalkForwardFold[]): number[] {
  return folds.flatMap((fold) => fold.split.testIndices);
}

function assertHash(value: string, name: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${name}_MUST_BE_SHA256`);
}

function assertEvidenceIntegrity(input: ResearchEvidenceEngineInput, policy: ResearchPolicy): { dsr: DsrResult; psr: PsrResult; decision: ReturnType<typeof validateResearchEvidenceForPromotion> } {
  if (!input.campaign.passedSelectionGates) throw new Error('CAMPAIGN_SELECTION_GATES_NOT_PASSED');
  if (input.campaign.campaignId !== input.holdout.campaignId) throw new Error('EVIDENCE_CAMPAIGN_MISMATCH');
  if (input.campaign.selectedCandidateId !== input.holdout.selectedCandidateId) throw new Error('EVIDENCE_CANDIDATE_MISMATCH');
  if (input.campaign.evidenceHash !== input.holdout.selectionEvidenceHash) throw new Error('EVIDENCE_SELECTION_HASH_MISMATCH');
  if (input.holdout.summary.resultClass !== 'PASS') throw new Error('EVIDENCE_HOLDOUT_NOT_PASS');
  if (input.holdout.holdoutDatasetHash.length !== 64) throw new Error('INVALID_HOLDOUT_DATASET_HASH');
  assertHash(input.holdout.holdoutDatasetHash, 'HOLDOUT_DATASET_HASH');
  if (input.committedTrialCount !== input.campaign.committedTrialCount) throw new Error('EVIDENCE_TRIAL_COUNT_MISMATCH');
  if (input.selectedReturns.length < 2 || input.selectedReturns.some((value) => !Number.isFinite(value))) throw new Error('INVALID_SELECTED_RETURNS');
  const dsr = computeDeflatedSharpeRatio({ returns: input.selectedReturns, committedTrialCount: input.committedTrialCount });
  const psr = computeProbabilisticSharpeRatio({ returns: input.selectedReturns, benchmarkSharpe: input.benchmarkSharpe ?? 0 });
  if (Math.abs(dsr.dsr - input.campaign.dsr) > 1e-12) throw new Error('CAMPAIGN_DSR_MISMATCH');
  if (Math.abs(input.pboCscv.pbo - input.campaign.pbo) > 1e-12) throw new Error('CAMPAIGN_PBO_MISMATCH');
  if (input.walkForward.folds.length < 2) throw new Error('INSUFFICIENT_WALK_FORWARD_FOLDS');
  const decision = validateResearchEvidenceForPromotion({
    effectiveOosOpportunities: input.walkForward.effectiveOosOpportunities,
    walkForward: input.walkForward,
    pboCscv: input.pboCscv,
    regimeCoverage: input.regimeCoverage,
    pbo: input.pboCscv.pbo,
    contiguousBlockNetReturns: input.contiguousBlockNetReturns,
    calendarWeekNetReturns: input.calendarWeekNetReturns,
    regimeIds: input.regimeIds,
    stressedNetExpectancy: input.stressedNetExpectancy,
    statistical: input.statistical,
    selectedReturns: input.selectedReturns,
    dsrResult: { method: dsr.method, sampleCount: dsr.sampleCount, committedTrialCount: dsr.committedTrialCount, dsr: dsr.dsr },
  }, policy, input.committedTrialCount);
  return { dsr, psr, decision };
}

export function buildFullResearchEvidencePackage(input: ResearchEvidenceEngineInput, policy: ResearchPolicy): FullResearchEvidencePackage {
  const { dsr, psr, decision } = assertEvidenceIntegrity(input, policy);
  const testIndexHash = sha256Hex(JSON.stringify(canonicalTestIndices(input.walkForward.folds)));
  const base = {
    schemaVersion: 'v2.9-full-research-evidence-v1' as const,
    campaignId: input.campaign.campaignId,
    researchProgramId: input.campaign.researchProgramId,
    candidateId: input.campaign.selectedCandidateId,
    selectionPolicyHash: input.campaign.selectionPolicyHash,
    selectionEvidenceHash: input.campaign.evidenceHash,
    holdoutEvidenceHash: input.holdout.evidenceHash,
    holdoutDatasetHash: input.holdout.holdoutDatasetHash,
    selectedReturnsHash: sha256Hex(JSON.stringify(input.selectedReturns)),
    committedTrialCount: input.committedTrialCount,
    pbo: input.pboCscv.pbo,
    dsr,
    psr,
    walkForward: { foldCount: input.walkForward.folds.length, effectiveOosOpportunities: input.walkForward.effectiveOosOpportunities, testIndexHash },
    regimeCoverage: { distinctRegimes: input.regimeCoverage.distinctRegimes, regimeIds: [...input.regimeIds].sort() },
    costStressNetExpectancy: input.stressedNetExpectancy,
    statisticalDecision: decision,
  };
  return { ...base, evidenceHash: sha256Hex(JSON.stringify(base)) };
}

export function assertFullResearchEvidencePackage(pkg: FullResearchEvidencePackage): void {
  const { evidenceHash, ...base } = pkg;
  const expected = sha256Hex(JSON.stringify(base));
  if (evidenceHash !== expected) throw new Error('FULL_RESEARCH_EVIDENCE_TAMPERED');
}

export class ResearchEvidenceLedger {
  private writeQueue: Promise<void> = Promise.resolve();
  constructor(private readonly path: string) {}

  private async records(): Promise<EvidenceLedgerRecord[]> {
    try {
      const text = await readFile(this.path, 'utf8');
      return text.trim() ? text.trim().split('\n').map((line: string) => JSON.parse(line) as EvidenceLedgerRecord) : [];
    } catch (error) {
      const code = error as { code?: string };
      if (code.code === 'ENOENT') return [];
      throw error;
    }
  }

  private async append(record: EvidenceLedgerRecord): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const handle = await open(this.path, 'a+');
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async commit(pkg: FullResearchEvidencePackage): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      assertFullResearchEvidencePackage(pkg);
      const records = await this.records();
      if (records.some((record) => record.campaignId === pkg.campaignId)) throw new Error('RESEARCH_EVIDENCE_ALREADY_COMMITTED');
      if (records.some((record) => record.evidenceHash === pkg.evidenceHash)) throw new Error('RESEARCH_EVIDENCE_DUPLICATE_HASH');
      await this.append({ ...pkg, kind: 'FULL_RESEARCH_EVIDENCE', recordedAt: new Date().toISOString() });
    });
    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async get(campaignId: string): Promise<EvidenceLedgerRecord | undefined> {
    return (await this.records()).find((record) => record.campaignId === campaignId);
  }
}

export type DeclaredRegimeProfile = { segments: readonly RegimeSegment[]; regimeVersionHash: string };
