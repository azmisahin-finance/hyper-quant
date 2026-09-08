import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndependentStatisticalEvidenceReport, assertIndependentStatisticalEvidence, type IndependentStatisticalInput } from '../../src/research/independent-statistics.js';
import { computeDeflatedSharpeRatio } from '../../src/research/dsr.js';
import type { CampaignCandidateRecord, CampaignFinalRecord } from '../../src/research/campaign-ledger.js';

const returns = Array.from({ length: 24 }, (_, index) => (index % 2 === 0 ? 0.006 : 0.002));
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function input(overrides: Partial<IndependentStatisticalInput> = {}): IndependentStatisticalInput {
  const dsr = computeDeflatedSharpeRatio({ returns, committedTrialCount: 2 });
  const campaign: CampaignFinalRecord = {
    kind: 'CAMPAIGN_FINAL',
    campaignId: 'C-RPT03',
    researchProgramId: 'P-RPT03',
    selectionPolicyHash: 'selection-v1',
    selectedCandidateId: 'A',
    selectedCandidateIndex: 0,
    committedTrialCount: 2,
    pbo: 0.25,
    dsr: dsr.dsr,
    dsrMethod: 'CLASSIC_DSR_LS',
    dsrReturnConvention: 'PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV',
    passedSelectionGates: true,
    evidenceHash: 'e'.repeat(64),
    recordedAt: new Date(0).toISOString(),
  };
  const candidate: CampaignCandidateRecord = {
    kind: 'CAMPAIGN_CANDIDATE',
    campaignId: campaign.campaignId,
    candidateId: 'A',
    trialId: 'T-A',
    outcome: 'COMPLETED',
    returnCount: returns.length,
    score: 0.004,
    returnHash: hash(returns),
    recordedAt: new Date(0).toISOString(),
  };
  return {
    campaign,
    campaignCandidates: [candidate],
    registeredTrialIds: ['T-A', 'T-B'],
    selectedReturns: returns,
    datasetHash: 'd'.repeat(64),
    datasetVersion: 'fixture-1',
    codeHash: 'c'.repeat(64),
    configHash: 'f'.repeat(64),
    ...overrides,
  };
}

test('RPT-03 independently recomputes exact campaign DSR/PSR and remains reproducible', () => {
  const first = buildIndependentStatisticalEvidenceReport(input());
  const repeat = buildIndependentStatisticalEvidenceReport(input());
  assert.equal(first.outcome, 'COMPLETED');
  assert.equal(first.result?.committedTrialCount, 2);
  assert.equal(first.result?.dsr.returnConvention, 'PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV');
  assert.equal(first.result?.psr.returnConvention, 'PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV');
  assert.equal(first.inputHash, repeat.inputHash);
  assert.equal(first.resultHash, repeat.resultHash);
  assert.equal(first.evidenceHash, repeat.evidenceHash);
  assert.doesNotThrow(() => assertIndependentStatisticalEvidence(first));
});

test('RPT-03 rejects convention and analyst-supplied metric substitution', () => {
  const convention = buildIndependentStatisticalEvidenceReport(input({
    campaign: { ...input().campaign, dsrReturnConvention: 'ANALYST_SUPPLIED' as CampaignFinalRecord['dsrReturnConvention'] },
  }));
  assert.equal(convention.outcome, 'FAIL');
  assert.equal(convention.errorCode, 'STATISTICAL_RETURN_CONVENTION_MISMATCH');
  const substituted = buildIndependentStatisticalEvidenceReport(input({
    campaign: { ...input().campaign, dsr: 0.999999 },
  }));
  assert.equal(substituted.outcome, 'FAIL');
  assert.equal(substituted.errorCode, 'CAMPAIGN_DSR_MISMATCH');
});

test('RPT-03 reports non-finite and zero-variance returns as FAIL', () => {
  const nonFinite = buildIndependentStatisticalEvidenceReport(input({ selectedReturns: [0.01, Number.NaN] }));
  assert.equal(nonFinite.outcome, 'FAIL');
  assert.equal(nonFinite.errorCode, 'NON_FINITE_SELECTED_RETURN');
  const zeroVariance = [0.01, 0.01, 0.01];
  const zero = buildIndependentStatisticalEvidenceReport(input({
    selectedReturns: zeroVariance,
    campaignCandidates: [{ ...input().campaignCandidates[0], returnCount: zeroVariance.length, returnHash: hash(zeroVariance) }],
  }));
  assert.equal(zero.outcome, 'FAIL');
  assert.equal(zero.errorCode, 'ZERO_DSR_VARIANCE');
});

test('RPT-03 blocks campaigns that did not pass selection gates and fails trial drift', () => {
  const blocked = buildIndependentStatisticalEvidenceReport(input({ campaign: { ...input().campaign, passedSelectionGates: false } }));
  assert.equal(blocked.outcome, 'BLOCKED');
  assert.equal(blocked.errorCode, 'CAMPAIGN_SELECTION_GATES_NOT_PASSED');
  const drift = buildIndependentStatisticalEvidenceReport(input({ registeredTrialIds: ['T-A'] }));
  assert.equal(drift.outcome, 'FAIL');
  assert.equal(drift.errorCode, 'INDEPENDENT_TRIAL_COUNT_MISMATCH');
});
