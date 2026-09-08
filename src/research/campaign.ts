import { createHash } from 'node:crypto';
import { ResearchTrialLedger, type ResearchTrialReceipt } from './trial-ledger.js';
import { runSearchCampaignDiagnostics, type SearchCampaignDiagnostics } from './search-diagnostics.js';
import { ResearchCampaignLedger } from './campaign-ledger.js';

export type CampaignCandidate = {
  candidateId: string;
  receipt: ResearchTrialReceipt;
  run: () => Promise<{ returns: readonly number[] }>;
};

export type CampaignPolicy = {
  blockCount: number;
  maxCombinations?: number;
  maxPbo: number;
  minDsr: number;
};

export type ResearchCampaignSpec = {
  campaignId: string;
  researchProgramId: string;
  selectionPolicyHash: string;
  candidates: readonly CampaignCandidate[];
  policy: CampaignPolicy;
};

export type CampaignCandidateResult = {
  candidateId: string;
  returns: readonly number[];
  score: number;
  outcome: 'COMPLETED' | 'CRASHED';
};

export type ResearchCampaignResult = {
  campaignId: string;
  researchProgramId: string;
  committedTrialCount: number;
  selectedCandidateId: string;
  selectedCandidateIndex: number;
  candidateResults: readonly CampaignCandidateResult[];
  diagnostics: SearchCampaignDiagnostics;
  selectionScore: number;
  passedSelectionGates: boolean;
  evidenceHash: string;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashReturns(values: readonly number[]): string {
  return sha256Hex(JSON.stringify(values));
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('EMPTY_CAMPAIGN_RETURN_SERIES');
  if (values.some((value) => !Number.isFinite(value))) throw new Error('NON_FINITE_CAMPAIGN_RETURN');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function assertSpec(spec: ResearchCampaignSpec): void {
  if (!spec.campaignId || !spec.researchProgramId || !spec.selectionPolicyHash) throw new Error('INVALID_CAMPAIGN_IDENTITY');
  if (spec.candidates.length < 2) throw new Error('INSUFFICIENT_CAMPAIGN_CANDIDATES');
  if (!Number.isInteger(spec.policy.blockCount) || spec.policy.blockCount < 4 || spec.policy.blockCount % 2 !== 0) throw new Error('INVALID_CAMPAIGN_BLOCK_COUNT');
  if (!Number.isFinite(spec.policy.maxPbo) || spec.policy.maxPbo <= 0 || spec.policy.maxPbo > 1) throw new Error('INVALID_CAMPAIGN_MAX_PBO');
  if (!Number.isFinite(spec.policy.minDsr) || spec.policy.minDsr < 0 || spec.policy.minDsr > 1) throw new Error('INVALID_CAMPAIGN_MIN_DSR');
  const candidateIds = new Set<string>();
  const trialIds = new Set<string>();
  for (const candidate of spec.candidates) {
    if (!candidate.candidateId || candidateIds.has(candidate.candidateId)) throw new Error('DUPLICATE_CAMPAIGN_CANDIDATE');
    candidateIds.add(candidate.candidateId);
    if (candidate.receipt.researchProgramId !== spec.researchProgramId) throw new Error('CAMPAIGN_PROGRAM_MISMATCH');
    if (candidate.receipt.selectionPolicyHash !== spec.selectionPolicyHash) throw new Error('CAMPAIGN_SELECTION_POLICY_MISMATCH');
    if (trialIds.has(candidate.receipt.trialId)) throw new Error('DUPLICATE_CAMPAIGN_TRIAL');
    trialIds.add(candidate.receipt.trialId);
  }
}

/**
 * Controlled non-live campaign orchestrator.
 * Every candidate is receipted before compute, and completed candidates are
 * committed as INCONCLUSIVE until the campaign-level selection/diagnostic gate
 * runs. Holdout execution is intentionally outside this search phase.
 */
export class ResearchCampaignRunner {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly trialLedger: ResearchTrialLedger, private readonly campaignLedger: ResearchCampaignLedger) {}

  async run(spec: ResearchCampaignSpec): Promise<ResearchCampaignResult> {
    const operation = this.queue.then(async () => {
      assertSpec(spec);
      if (await this.campaignLedger.isFinal(spec.campaignId)) throw new Error('CAMPAIGN_ALREADY_FINAL');
      const candidateIds = spec.candidates.map((candidate) => candidate.candidateId);
      await this.campaignLedger.start({ kind: 'CAMPAIGN_START', campaignId: spec.campaignId, researchProgramId: spec.researchProgramId, selectionPolicyHash: spec.selectionPolicyHash, candidateIds, createdAt: new Date().toISOString() });
      const beforeCount = await this.trialLedger.countRegisteredTrials(spec.researchProgramId);
      const candidateResults: CampaignCandidateResult[] = [];

      for (const candidate of spec.candidates) {
        await this.trialLedger.registerBeforeRun(candidate.receipt);
        try {
          const output = await candidate.run();
          const returns = [...output.returns];
          const score = mean(returns);
          candidateResults.push({ candidateId: candidate.candidateId, returns, score, outcome: 'COMPLETED' });
          await this.trialLedger.recordOutcome({ ...candidate.receipt, outcome: 'INCONCLUSIVE', completedAt: new Date().toISOString() });
          await this.campaignLedger.recordCandidate({ kind: 'CAMPAIGN_CANDIDATE', campaignId: spec.campaignId, candidateId: candidate.candidateId, trialId: candidate.receipt.trialId, outcome: 'COMPLETED', returnCount: returns.length, score, returnHash: hashReturns(returns), recordedAt: new Date().toISOString() });
        } catch (error) {
          await this.trialLedger.recordOutcome({ ...candidate.receipt, outcome: 'CRASHED', completedAt: new Date().toISOString() });
          await this.campaignLedger.recordCandidate({ kind: 'CAMPAIGN_CANDIDATE', campaignId: spec.campaignId, candidateId: candidate.candidateId, trialId: candidate.receipt.trialId, outcome: 'CRASHED', returnCount: 0, score: Number.NEGATIVE_INFINITY, returnHash: hashReturns([]), recordedAt: new Date().toISOString() });
          throw error;
        }
      }

      if (candidateResults.some((candidate) => candidate.outcome !== 'COMPLETED')) throw new Error('CAMPAIGN_CANDIDATE_INCOMPLETE');
      const committedTrialCount = await this.trialLedger.countRegisteredTrials(spec.researchProgramId);
      if (committedTrialCount - beforeCount !== spec.candidates.length) throw new Error('CAMPAIGN_TRIAL_COUNT_MISMATCH');

      let selectedCandidateIndex = 0;
      for (let i = 1; i < candidateResults.length; i += 1) {
        const current = candidateResults[i];
        const selected = candidateResults[selectedCandidateIndex];
        if (current.score > selected.score || (current.score === selected.score && current.candidateId.localeCompare(selected.candidateId) < 0)) {
          selectedCandidateIndex = i;
        }
      }

      const candidateReturns = candidateResults.map((candidate) => candidate.returns);
      const diagnostics = runSearchCampaignDiagnostics({
        candidateReturns,
        selectedCandidateIndex,
        blockCount: spec.policy.blockCount,
        committedTrialCount,
        maxCombinations: spec.policy.maxCombinations,
      });
      const passedSelectionGates = diagnostics.pboCscv.pbo < spec.policy.maxPbo && diagnostics.dsr.dsr >= spec.policy.minDsr;
      const selectedCandidate = candidateResults[selectedCandidateIndex];
      const evidenceHash = sha256Hex(JSON.stringify({
        campaignId: spec.campaignId,
        researchProgramId: spec.researchProgramId,
        selectionPolicyHash: spec.selectionPolicyHash,
        committedTrialCount,
        candidateResults: candidateResults.map((candidate) => ({ candidateId: candidate.candidateId, score: candidate.score, outcome: candidate.outcome, returnHash: hashReturns(candidate.returns) })),
        diagnostics,
        passedSelectionGates,
      }));
      const result: ResearchCampaignResult = {
        campaignId: spec.campaignId,
        researchProgramId: spec.researchProgramId,
        committedTrialCount,
        selectedCandidateId: selectedCandidate.candidateId,
        selectedCandidateIndex,
        candidateResults,
        diagnostics,
        selectionScore: selectedCandidate.score,
        passedSelectionGates,
        evidenceHash,
      };
      await this.campaignLedger.finalize({ kind: 'CAMPAIGN_FINAL', campaignId: spec.campaignId, researchProgramId: spec.researchProgramId, selectedCandidateId: result.selectedCandidateId, selectedCandidateIndex: result.selectedCandidateIndex, committedTrialCount, pbo: diagnostics.pboCscv.pbo, dsr: diagnostics.dsr.dsr, passedSelectionGates, evidenceHash, recordedAt: new Date().toISOString() });
      return result;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}
