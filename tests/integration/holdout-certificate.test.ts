import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSealedHoldoutCertificate,
  buildSealedHoldoutCertificate,
  selectDeterministicHoldout,
} from '../../src/research/holdout-certificate.js';
import type { CampaignFinalRecord } from '../../src/research/campaign-ledger.js';

const campaign: CampaignFinalRecord = {
  kind: 'CAMPAIGN_FINAL',
  campaignId: 'C-HOLDOUT-CERT',
  researchProgramId: 'P-HOLDOUT',
  selectionPolicyHash: 'selection-v1',
  selectedCandidateId: 'candidate-a',
  selectedCandidateIndex: 0,
  committedTrialCount: 2,
  pbo: 0,
  dsr: 0.2,
  dsrMethod: 'CLASSIC_DSR_LS',
  dsrReturnConvention: 'PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV',
  passedSelectionGates: true,
  evidenceHash: 'e'.repeat(64),
  recordedAt: new Date(0).toISOString(),
};

function input(overrides: Partial<Parameters<typeof buildSealedHoldoutCertificate>[0]> = {}) {
  return {
    campaign,
    reservation: {
      kind: 'HOLDOUT_RESERVATION' as const,
      reservationId: 'R-CERT',
      programRootId: 'ROOT',
      familyId: 'FAMILY',
      lineageId: 'LINEAGE',
      scope: 'LINEAGE' as const,
      units: 1,
      resultClass: 'PENDING',
      campaignId: campaign.campaignId,
      candidateId: campaign.selectedCandidateId,
      selectionEvidenceHash: campaign.evidenceHash,
    },
    holdoutDatasetHash: 'd'.repeat(64),
    candidateIds: ['candidate-a', 'candidate-b'],
    holdoutIds: ['bar-1', 'bar-2', 'bar-3', 'bar-4', 'bar-5'],
    processIsolation: 'UNVERIFIED' as const,
    physicalIsolation: 'UNVERIFIED' as const,
    evaluate: async () => ({ resultClass: 'PASS' as const, netExpectancy: 0.01, effectiveOosOpportunities: 20, maxDrawdown: 0.1, tailLoss: 0.05 }),
    ...overrides,
  };
}

test('holdout selection and certificate hashes are reproducible', async () => {
  const firstSelection = selectDeterministicHoldout('d'.repeat(64), campaign.campaignId, ['bar-1', 'bar-2', 'bar-3', 'bar-4']);
  const secondSelection = selectDeterministicHoldout('d'.repeat(64), campaign.campaignId, ['bar-1', 'bar-2', 'bar-3', 'bar-4']);
  assert.deepEqual(firstSelection, secondSelection);
  const first = await buildSealedHoldoutCertificate(input({ processIsolation: 'VERIFIED', physicalIsolation: 'VERIFIED' }));
  const second = await buildSealedHoldoutCertificate(input({ processIsolation: 'VERIFIED', physicalIsolation: 'VERIFIED' }));
  assert.equal(first.outcome, 'COMPLETED');
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => assertSealedHoldoutCertificate(first));
});

test('certificate blocks unverifiable physical isolation without claiming it', async () => {
  let evaluated = false;
  const certificate = await buildSealedHoldoutCertificate(input({ evaluate: async () => { evaluated = true; return { resultClass: 'PASS', netExpectancy: 1, effectiveOosOpportunities: 1, maxDrawdown: 0, tailLoss: 0 }; } }));
  assert.equal(certificate.outcome, 'BLOCKED');
  assert.equal(certificate.physicalIsolation, 'UNVERIFIED');
  assert.equal(certificate.errorCode, 'PHYSICAL_ISOLATION_UNVERIFIED');
  assert.equal(evaluated, false);
});

test('certificate rejects campaign binding, leakage, and selection mutation attempts', async () => {
  const binding = await buildSealedHoldoutCertificate(input({
    reservation: { ...input().reservation, candidateId: 'other-candidate' },
    processIsolation: 'VERIFIED',
    physicalIsolation: 'VERIFIED',
  }));
  assert.equal(binding.outcome, 'FAIL');
  assert.equal(binding.errorCode, 'HOLDOUT_CAMPAIGN_BINDING_MISMATCH');
  const leakage = await buildSealedHoldoutCertificate(input({ candidateIds: ['candidate-a', 'bar-1'], processIsolation: 'VERIFIED', physicalIsolation: 'VERIFIED' }));
  assert.equal(leakage.errorCode, 'HOLDOUT_CAMPAIGN_LEAKAGE');
  const mutation = await buildSealedHoldoutCertificate(input({
    processIsolation: 'VERIFIED',
    physicalIsolation: 'VERIFIED',
    evaluate: async (selection) => {
      (selection.selectedIds as string[]).push('injected');
      return { resultClass: 'PASS', netExpectancy: 0.01, effectiveOosOpportunities: 1, maxDrawdown: 0, tailLoss: 0 };
    },
  }));
  assert.equal(mutation.errorCode, 'HOLDOUT_SELECTION_MUTATED');
});
