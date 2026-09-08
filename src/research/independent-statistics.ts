import { createHash } from 'node:crypto';
import { computeDeflatedSharpeRatio, DSR_RETURN_CONVENTION, type DsrResult } from './dsr.js';
import { computeProbabilisticSharpeRatio, PSR_RETURN_CONVENTION, type PsrResult } from './psr.js';
import type { CampaignCandidateRecord, CampaignFinalRecord } from './campaign-ledger.js';

export const INDEPENDENT_STATISTICAL_REPORT_ID = 'RPT-03' as const;
export const INDEPENDENT_STATISTICAL_REPORT_NAME = 'Independent Statistical Evidence Package' as const;
export const INDEPENDENT_STATISTICAL_SCOPE = {
  venue: 'BtcTurk',
  market: 'BTC/TRY',
  mode: 'READ_ONLY_NON_LIVE',
} as const;

export type IndependentStatisticalOutcome = 'COMPLETED' | 'FAIL' | 'BLOCKED';

export type IndependentStatisticalInput = {
  campaign: CampaignFinalRecord;
  campaignCandidates: readonly CampaignCandidateRecord[];
  registeredTrialIds: readonly string[];
  selectedReturns: readonly number[];
  datasetHash: string;
  datasetVersion: string;
  codeHash: string;
  configHash: string;
  benchmarkSharpe?: number;
};

export type IndependentStatisticalResult = {
  committedTrialCount: number;
  selectedReturnHash: string;
  dsr: DsrResult;
  psr: PsrResult;
  lineage: {
    datasetHash: string;
    datasetVersion: string;
    codeHash: string;
    configHash: string;
  };
};

export type IndependentStatisticalEvidenceReport = {
  reportId: typeof INDEPENDENT_STATISTICAL_REPORT_ID;
  reportName: typeof INDEPENDENT_STATISTICAL_REPORT_NAME;
  scope: typeof INDEPENDENT_STATISTICAL_SCOPE;
  campaignId: string;
  outcome: IndependentStatisticalOutcome;
  inputHash: string;
  resultHash?: string;
  evidenceHash: string;
  errorCode?: string;
  result?: IndependentStatisticalResult;
};

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fail(input: IndependentStatisticalInput, inputHash: string, error: unknown): IndependentStatisticalEvidenceReport {
  const errorCode = error instanceof Error ? error.message : 'UNKNOWN_FAILURE';
  return {
    reportId: INDEPENDENT_STATISTICAL_REPORT_ID,
    reportName: INDEPENDENT_STATISTICAL_REPORT_NAME,
    scope: INDEPENDENT_STATISTICAL_SCOPE,
    campaignId: input.campaign.campaignId,
    outcome: 'FAIL',
    inputHash,
    evidenceHash: sha256({ inputHash, outcome: 'FAIL', errorCode }),
    errorCode,
  };
}

export function buildIndependentStatisticalEvidenceReport(input: IndependentStatisticalInput): IndependentStatisticalEvidenceReport {
  const inputHash = sha256({
    campaign: input.campaign,
    campaignCandidates: input.campaignCandidates,
    registeredTrialIds: input.registeredTrialIds,
    selectedReturns: input.selectedReturns,
    datasetHash: input.datasetHash,
    datasetVersion: input.datasetVersion,
    codeHash: input.codeHash,
    configHash: input.configHash,
    benchmarkSharpe: input.benchmarkSharpe ?? 0,
  });

  try {
    if (!input.campaign.passedSelectionGates) {
      return {
        reportId: INDEPENDENT_STATISTICAL_REPORT_ID,
        reportName: INDEPENDENT_STATISTICAL_REPORT_NAME,
        scope: INDEPENDENT_STATISTICAL_SCOPE,
        campaignId: input.campaign.campaignId,
        outcome: 'BLOCKED',
        inputHash,
        evidenceHash: sha256({ inputHash, outcome: 'BLOCKED', errorCode: 'CAMPAIGN_SELECTION_GATES_NOT_PASSED' }),
        errorCode: 'CAMPAIGN_SELECTION_GATES_NOT_PASSED',
      };
    }
    if (input.campaign.dsrMethod !== 'CLASSIC_DSR_LS' || input.campaign.dsrReturnConvention !== DSR_RETURN_CONVENTION) {
      throw new Error('STATISTICAL_RETURN_CONVENTION_MISMATCH');
    }
    if (!/^[0-9a-f]{64}$/.test(input.datasetHash) || !/^[0-9a-f]{64}$/.test(input.codeHash) || !/^[0-9a-f]{64}$/.test(input.configHash)) {
      throw new Error('INVALID_STATISTICAL_LINEAGE_HASH');
    }
    if (new Set(input.registeredTrialIds).size !== input.registeredTrialIds.length || input.registeredTrialIds.length < 1) {
      throw new Error('INVALID_REGISTERED_TRIAL_IDS');
    }
    const committedTrialCount = input.registeredTrialIds.length;
    if (committedTrialCount !== input.campaign.committedTrialCount) throw new Error('INDEPENDENT_TRIAL_COUNT_MISMATCH');
    const selected = input.campaignCandidates.find((candidate) => candidate.candidateId === input.campaign.selectedCandidateId);
    if (!selected) throw new Error('SELECTED_CAMPAIGN_CANDIDATE_MISSING');
    if (selected.campaignId !== input.campaign.campaignId || selected.outcome !== 'COMPLETED') throw new Error('SELECTED_CAMPAIGN_CANDIDATE_INVALID');
    if (input.selectedReturns.some((value) => !Number.isFinite(value))) throw new Error('NON_FINITE_SELECTED_RETURN');
    if (selected.returnCount !== input.selectedReturns.length) throw new Error('SELECTED_RETURN_COUNT_MISMATCH');
    if (sha256(input.selectedReturns) !== selected.returnHash) throw new Error('SELECTED_RETURN_HASH_MISMATCH');
    if (selected.candidateId !== input.campaign.selectedCandidateId) throw new Error('SELECTED_CANDIDATE_MISMATCH');

    const dsr = computeDeflatedSharpeRatio({ returns: input.selectedReturns, committedTrialCount, benchmarkSharpe: input.benchmarkSharpe });
    const psr = computeProbabilisticSharpeRatio({ returns: input.selectedReturns, benchmarkSharpe: input.benchmarkSharpe });
    if (dsr.returnConvention !== DSR_RETURN_CONVENTION || psr.returnConvention !== PSR_RETURN_CONVENTION) throw new Error('STATISTICAL_RETURN_CONVENTION_MISMATCH');
    if (Math.abs(dsr.dsr - input.campaign.dsr) > 1e-12) throw new Error('CAMPAIGN_DSR_MISMATCH');
    const result: IndependentStatisticalResult = {
      committedTrialCount,
      selectedReturnHash: selected.returnHash,
      dsr,
      psr,
      lineage: { datasetHash: input.datasetHash, datasetVersion: input.datasetVersion, codeHash: input.codeHash, configHash: input.configHash },
    };
    const resultHash = sha256(result);
    return {
      reportId: INDEPENDENT_STATISTICAL_REPORT_ID,
      reportName: INDEPENDENT_STATISTICAL_REPORT_NAME,
      scope: INDEPENDENT_STATISTICAL_SCOPE,
      campaignId: input.campaign.campaignId,
      outcome: 'COMPLETED',
      inputHash,
      resultHash,
      evidenceHash: sha256({ inputHash, resultHash, result }),
      result,
    };
  } catch (error) {
    return fail(input, inputHash, error);
  }
}

export function assertIndependentStatisticalEvidence(report: IndependentStatisticalEvidenceReport): void {
  const expected = report.outcome === 'COMPLETED' && report.result && report.resultHash
    ? sha256({ inputHash: report.inputHash, resultHash: report.resultHash, result: report.result })
    : sha256({ inputHash: report.inputHash, outcome: report.outcome, errorCode: report.errorCode });
  if (report.evidenceHash !== expected) throw new Error('INDEPENDENT_STATISTICAL_EVIDENCE_TAMPERED');
}
