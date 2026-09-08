import { createHash } from 'node:crypto';
import type { CampaignFinalRecord } from './campaign-ledger.js';
import type { HoldoutReservation, HoldoutResultClass } from './holdout-ledger.js';

export const SEALED_HOLDOUT_REPORT_ID = 'RPT-04' as const;
export const SEALED_HOLDOUT_REPORT_NAME = 'Sealed Holdout Evaluation Certificate' as const;

export const SEALED_HOLDOUT_SCOPE = {
  venue: 'BtcTurk',
  market: 'BTC/TRY',
  mode: 'READ_ONLY_NON_LIVE',
} as const;

export type IsolationStatus = 'VERIFIED' | 'UNVERIFIED' | 'UNKNOWN';
export type SealedHoldoutOutcome = 'COMPLETED' | 'FAIL' | 'BLOCKED';

export type SealedHoldoutSelection = {
  datasetHash: string;
  selectedIds: readonly string[];
  selectionHash: string;
};

export type SealedHoldoutEvaluation = {
  resultClass: HoldoutResultClass;
  netExpectancy: number;
  effectiveOosOpportunities: number;
  maxDrawdown: number;
  tailLoss: number;
};

export type SealedHoldoutCertificateInput = {
  campaign: CampaignFinalRecord;
  reservation: HoldoutReservation;
  holdoutDatasetHash: string;
  candidateIds: readonly string[];
  holdoutIds: readonly string[];
  processIsolation: IsolationStatus;
  physicalIsolation: IsolationStatus;
  evaluate: (selection: SealedHoldoutSelection) => Promise<SealedHoldoutEvaluation>;
};

export type SealedHoldoutCertificate = {
  reportId: typeof SEALED_HOLDOUT_REPORT_ID;
  reportName: typeof SEALED_HOLDOUT_REPORT_NAME;
  scope: typeof SEALED_HOLDOUT_SCOPE;
  campaignId: string;
  selectedCandidateId: string;
  reservationId: string;
  outcome: SealedHoldoutOutcome;
  processIsolation: IsolationStatus;
  physicalIsolation: IsolationStatus;
  selection: SealedHoldoutSelection;
  campaignHash: string;
  reservationHash: string;
  inputHash: string;
  resultHash?: string;
  evidenceHash: string;
  errorCode?: string;
  evaluation?: SealedHoldoutEvaluation;
};

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertHash(value: string, errorCode: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(errorCode);
}

function assertEvaluation(value: SealedHoldoutEvaluation): void {
  if (!value || !['PASS', 'FAIL', 'INCONCLUSIVE'].includes(value.resultClass)
    || !Number.isFinite(value.netExpectancy)
    || !Number.isInteger(value.effectiveOosOpportunities)
    || value.effectiveOosOpportunities <= 0
    || !Number.isFinite(value.maxDrawdown) || value.maxDrawdown < 0
    || !Number.isFinite(value.tailLoss) || value.tailLoss < 0) {
    throw new Error('INVALID_HOLDOUT_EVALUATION');
  }
}

/**
 * Selects a stable subset without exposing ordering or data values to the
 * campaign. IDs are ranked by a campaign/dataset seed, so repeated runs are
 * byte-for-byte reproducible.
 */
export function selectDeterministicHoldout(
  datasetHash: string,
  campaignId: string,
  ids: readonly string[],
  fraction = 0.2,
): SealedHoldoutSelection {
  assertHash(datasetHash, 'INVALID_HOLDOUT_DATASET_HASH');
  if (!campaignId || ids.length === 0 || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new Error('INVALID_HOLDOUT_SELECTION');
  }
  if (new Set(ids).size !== ids.length || ids.some((id) => !id)) throw new Error('INVALID_HOLDOUT_IDS');
  const ranked = ids.map((id) => ({
    id,
    rank: sha256({ datasetHash, campaignId, id }),
  })).sort((left, right) => left.rank.localeCompare(right.rank) || left.id.localeCompare(right.id));
  const count = Math.max(1, Math.ceil(ids.length * fraction));
  const selectedIds = ranked.slice(0, count).map(({ id }) => id);
  return { datasetHash, selectedIds, selectionHash: sha256({ datasetHash, campaignId, selectedIds }) };
}

export async function buildSealedHoldoutCertificate(input: SealedHoldoutCertificateInput): Promise<SealedHoldoutCertificate> {
  const campaignHash = sha256(input.campaign);
  const reservationHash = sha256(input.reservation);
  const selection = selectDeterministicHoldout(input.holdoutDatasetHash, input.campaign.campaignId, input.holdoutIds);
  const inputHash = sha256({
    campaignHash,
    reservationHash,
    holdoutDatasetHash: input.holdoutDatasetHash,
    candidateIds: input.candidateIds,
    holdoutIds: input.holdoutIds,
    selection,
    processIsolation: input.processIsolation,
    physicalIsolation: input.physicalIsolation,
  });
  const base = {
    reportId: SEALED_HOLDOUT_REPORT_ID,
    reportName: SEALED_HOLDOUT_REPORT_NAME,
    scope: SEALED_HOLDOUT_SCOPE,
    campaignId: input.campaign.campaignId,
    selectedCandidateId: input.campaign.selectedCandidateId,
    reservationId: input.reservation.reservationId,
    processIsolation: input.processIsolation,
    physicalIsolation: input.physicalIsolation,
    selection,
    campaignHash,
    reservationHash,
    inputHash,
  };
  try {
    if (!input.campaign.passedSelectionGates) throw new Error('CAMPAIGN_SELECTION_GATES_NOT_PASSED');
    if (input.reservation.campaignId !== input.campaign.campaignId
      || input.reservation.candidateId !== input.campaign.selectedCandidateId
      || input.reservation.selectionEvidenceHash !== input.campaign.evidenceHash) {
      throw new Error('HOLDOUT_CAMPAIGN_BINDING_MISMATCH');
    }
    if (!input.candidateIds.includes(input.campaign.selectedCandidateId)) throw new Error('HOLDOUT_CAMPAIGN_BINDING_MISMATCH');
    if (input.holdoutIds.some((id) => input.candidateIds.includes(id))) {
      throw new Error('HOLDOUT_CAMPAIGN_LEAKAGE');
    }
    if (input.processIsolation !== 'VERIFIED' || input.physicalIsolation !== 'VERIFIED') {
      const errorCode = input.physicalIsolation !== 'VERIFIED' ? 'PHYSICAL_ISOLATION_UNVERIFIED' : 'PROCESS_ISOLATION_UNVERIFIED';
      return { ...base, outcome: 'BLOCKED', evidenceHash: sha256({ inputHash, outcome: 'BLOCKED', errorCode }), errorCode };
    }
    const before = sha256(selection);
    const evaluation = await input.evaluate(selection);
    if (sha256(selection) !== before) throw new Error('HOLDOUT_SELECTION_MUTATED');
    assertEvaluation(evaluation);
    const resultHash = sha256(evaluation);
    return { ...base, outcome: 'COMPLETED', evaluation, resultHash, evidenceHash: sha256({ inputHash, resultHash, evaluation }) };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN_FAILURE';
    return { ...base, outcome: 'FAIL', errorCode, evidenceHash: sha256({ inputHash, outcome: 'FAIL', errorCode }) };
  }
}

export function assertSealedHoldoutCertificate(certificate: SealedHoldoutCertificate): void {
  const expected = certificate.outcome === 'COMPLETED' && certificate.evaluation && certificate.resultHash
    ? sha256({ inputHash: certificate.inputHash, resultHash: certificate.resultHash, evaluation: certificate.evaluation })
    : sha256({ inputHash: certificate.inputHash, outcome: certificate.outcome, errorCode: certificate.errorCode });
  if (certificate.evidenceHash !== expected) throw new Error('SEALED_HOLDOUT_EVIDENCE_TAMPERED');
}
