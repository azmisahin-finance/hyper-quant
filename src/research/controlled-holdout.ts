import { createHash } from 'node:crypto';
import { HoldoutLedger, type HoldoutEvaluationInput, type HoldoutResultClass } from './holdout-ledger.js';
import { ResearchCampaignLedger } from './campaign-ledger.js';

export type HoldoutSummary = {
  resultClass: HoldoutResultClass;
  netExpectancy: number;
  effectiveOosOpportunities: number;
  maxDrawdown: number;
  tailLoss: number;
};

export type ControlledHoldoutRequest = {
  campaignId: string;
  selectedCandidateId: string;
  researchProgramId: string;
  selectionPolicyHash: string;
  selectionEvidenceHash: string;
  holdoutDatasetHash: string;
  reservation: HoldoutEvaluationInput;
  reservationId: string;
};

export type HoldoutEvidence = {
  campaignId: string;
  selectedCandidateId: string;
  researchProgramId: string;
  selectionPolicyHash: string;
  selectionEvidenceHash: string;
  holdoutDatasetHash: string;
  reservationId: string;
  summary: HoldoutSummary;
  evidenceHash: string;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertOpaqueSummary(summary: HoldoutSummary): void {
  const keys = summary && typeof summary === 'object' ? Object.keys(summary) : [];
  if (keys.some((key) => /^(raw|rows?|labels?|timestamps?|features?|prices?|symbols?)(?:_|$|[A-Z])/i.test(key))) throw new Error('RAW_HOLDOUT_PAYLOAD_FORBIDDEN');
  if (!summary || !['PASS', 'FAIL', 'INCONCLUSIVE'].includes(summary.resultClass)) throw new Error('INVALID_HOLDOUT_RESULT_CLASS');
  if (!Number.isFinite(summary.netExpectancy) || !Number.isInteger(summary.effectiveOosOpportunities) || summary.effectiveOosOpportunities <= 0 || !Number.isFinite(summary.maxDrawdown) || summary.maxDrawdown < 0 || !Number.isFinite(summary.tailLoss) || summary.tailLoss < 0) {
    throw new Error('INVALID_HOLDOUT_SUMMARY');
  }
}

export class ControlledHoldoutRunner {
  constructor(private readonly campaignLedger: ResearchCampaignLedger, private readonly holdoutLedger: HoldoutLedger) {}

  async run(request: ControlledHoldoutRequest, evaluateOpaque: () => Promise<HoldoutSummary>): Promise<HoldoutEvidence> {
    const final = await this.campaignLedger.getFinal(request.campaignId);
    if (!final) throw new Error('CAMPAIGN_FINAL_REQUIRED_BEFORE_HOLDOUT');
    if (!final.passedSelectionGates) throw new Error('CAMPAIGN_SELECTION_GATES_NOT_PASSED');
    if (final.researchProgramId !== request.researchProgramId) throw new Error('HOLDOUT_PROGRAM_MISMATCH');
    if (final.selectionPolicyHash !== request.selectionPolicyHash) throw new Error('HOLDOUT_SELECTION_POLICY_MISMATCH');
    if (final.selectedCandidateId !== request.selectedCandidateId) throw new Error('HOLDOUT_CANDIDATE_MISMATCH');
    if (final.evidenceHash !== request.selectionEvidenceHash) throw new Error('HOLDOUT_SELECTION_EVIDENCE_MISMATCH');
    if (!/^[0-9a-f]{64}$/.test(request.holdoutDatasetHash)) throw new Error('INVALID_HOLDOUT_DATASET_HASH');
    if (!request.reservationId) throw new Error('HOLDOUT_RESERVATION_REQUIRED');
    if (request.reservation.programRootId !== this.currentRoot()) throw new Error('HOLDOUT_PROGRAM_ROOT_MISMATCH');

    await this.holdoutLedger.reserve(request.reservation, request.reservationId, { campaignId: request.campaignId, candidateId: request.selectedCandidateId, selectionEvidenceHash: request.selectionEvidenceHash });
    try {
      const summary = await evaluateOpaque();
      assertOpaqueSummary(summary);
      const evidenceHash = sha256Hex(JSON.stringify({
        campaignId: request.campaignId,
        selectedCandidateId: request.selectedCandidateId,
        researchProgramId: request.researchProgramId,
        selectionPolicyHash: request.selectionPolicyHash,
        selectionEvidenceHash: request.selectionEvidenceHash,
        holdoutDatasetHash: request.holdoutDatasetHash,
        reservationId: request.reservationId,
        summary,
      }));
      await this.holdoutLedger.finalizeReservation(request.reservationId, summary.resultClass);
      return {
        campaignId: request.campaignId,
        selectedCandidateId: request.selectedCandidateId,
        researchProgramId: request.researchProgramId,
        selectionPolicyHash: request.selectionPolicyHash,
        selectionEvidenceHash: request.selectionEvidenceHash,
        holdoutDatasetHash: request.holdoutDatasetHash,
        reservationId: request.reservationId,
        summary,
        evidenceHash,
      };
    } catch (error) {
      await this.holdoutLedger.finalizeReservation(request.reservationId, 'INCONCLUSIVE').catch(() => undefined);
      throw error;
    }
  }

  private currentRoot(): string {
    return this.holdoutLedger.governedRootIdForVerification();
  }
}
