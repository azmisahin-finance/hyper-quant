import { createHash } from 'node:crypto';
import type { HoldoutEvidence } from './controlled-holdout.js';
import type { CampaignFinalRecord } from './campaign-ledger.js';

export type PromotionEvidencePackage = {
  campaignId: string;
  selectedCandidateId: string;
  selectionEvidenceHash: string;
  holdoutEvidenceHash: string;
  holdoutResultClass: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  promotionEvidenceHash: string;
};

export function buildPromotionEvidencePackage(campaign: CampaignFinalRecord, holdout: HoldoutEvidence): PromotionEvidencePackage {
  if (!campaign.passedSelectionGates) throw new Error('CAMPAIGN_SELECTION_GATES_NOT_PASSED');
  if (holdout.summary.resultClass !== 'PASS') throw new Error('HOLDOUT_NOT_PROMOTION_ELIGIBLE');
  if (campaign.campaignId !== holdout.campaignId || campaign.selectedCandidateId !== holdout.selectedCandidateId) throw new Error('PROMOTION_CANDIDATE_MISMATCH');
  if (campaign.evidenceHash !== holdout.selectionEvidenceHash) throw new Error('PROMOTION_SELECTION_EVIDENCE_MISMATCH');
  const base = { campaignId: campaign.campaignId, selectedCandidateId: campaign.selectedCandidateId, selectionEvidenceHash: campaign.evidenceHash, holdoutEvidenceHash: holdout.evidenceHash, holdoutResultClass: holdout.summary.resultClass };
  return { ...base, promotionEvidenceHash: createHash('sha256').update(JSON.stringify(base)).digest('hex') };
}

export function assertPromotionEvidencePackage(pkg: PromotionEvidencePackage): void {
  const base = { campaignId: pkg.campaignId, selectedCandidateId: pkg.selectedCandidateId, selectionEvidenceHash: pkg.selectionEvidenceHash, holdoutEvidenceHash: pkg.holdoutEvidenceHash, holdoutResultClass: pkg.holdoutResultClass };
  const expected = createHash('sha256').update(JSON.stringify(base)).digest('hex');
  if (pkg.promotionEvidenceHash !== expected) throw new Error('PROMOTION_EVIDENCE_TAMPERED');
}
