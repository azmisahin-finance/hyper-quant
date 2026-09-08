import { createHash } from 'node:crypto';
import { computeDeflatedSharpeRatio, type DsrResult } from './dsr.js';
import { computePboCscv, type CsCvResult } from './overfitting.js';

export type SearchCampaignInput = {
  candidateReturns: readonly (readonly number[])[];
  selectedCandidateIndex: number;
  blockCount: number;
  committedTrialCount: number;
  maxCombinations?: number;
};

export type SearchCampaignDiagnostics = {
  selectedCandidateIndex: number;
  committedTrialCount: number;
  selectedReturns: readonly number[];
  pboCscv: Pick<CsCvResult, 'pbo' | 'combinationsEvaluated'>;
  dsr: DsrResult;
  resultHash: string;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function runSearchCampaignDiagnostics(input: SearchCampaignInput): SearchCampaignDiagnostics {
  if (!Number.isInteger(input.selectedCandidateIndex) || input.selectedCandidateIndex < 0 || input.selectedCandidateIndex >= input.candidateReturns.length) throw new Error('INVALID_SELECTED_CANDIDATE');
  if (!Number.isInteger(input.committedTrialCount) || input.committedTrialCount < 1) throw new Error('INVALID_COMMITTED_TRIAL_COUNT');
  const pboCscv = computePboCscv({ candidateReturns: input.candidateReturns, blockCount: input.blockCount, maxCombinations: input.maxCombinations });
  const selectedReturns = [...input.candidateReturns[input.selectedCandidateIndex]];
  const dsr = computeDeflatedSharpeRatio({ returns: selectedReturns, committedTrialCount: input.committedTrialCount });
  const canonical = JSON.stringify({ selectedCandidateIndex: input.selectedCandidateIndex, committedTrialCount: input.committedTrialCount, candidateReturns: input.candidateReturns, blockCount: input.blockCount, pboCscv: { pbo: pboCscv.pbo, combinationsEvaluated: pboCscv.combinationsEvaluated }, dsr });
  return { selectedCandidateIndex: input.selectedCandidateIndex, committedTrialCount: input.committedTrialCount, selectedReturns, pboCscv: { pbo: pboCscv.pbo, combinationsEvaluated: pboCscv.combinationsEvaluated }, dsr, resultHash: sha256Hex(canonical) };
}
