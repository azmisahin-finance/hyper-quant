import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchTrialLedger } from '../../src/research/trial-ledger.js';
import { ResearchCampaignLedger } from '../../src/research/campaign-ledger.js';
import { ResearchCampaignRunner } from '../../src/research/campaign.js';
import { HoldoutLedger } from '../../src/research/holdout-ledger.js';
import { ControlledHoldoutRunner, type HoldoutSummary } from '../../src/research/controlled-holdout.js';
import { assertPromotionEvidencePackage, buildPromotionEvidencePackage } from '../../src/research/promotion-evidence.js';

const returnsA = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 0.006 : 0.002));
const returnsB = Array.from({ length: 24 }, () => 0.004);
function receipt(trialId: string) {
  return { trialId, researchProgramId: 'P-HOLDOUT', hypothesisId: `H-${trialId}`, codeHash: 'code', configHash: `cfg-${trialId}`, datasetHash: 'dataset', selectionPolicyHash: 'selection-v1', parentTrialIds: [], createdAt: new Date(0).toISOString() };
}
async function campaignAt(root: string, campaignId = 'C-HO') {
  const runner = new ResearchCampaignRunner(new ResearchTrialLedger(join(root, 'trials.jsonl')), new ResearchCampaignLedger(join(root, 'campaigns.jsonl')));
  return runner.run({
    campaignId,
    researchProgramId: 'P-HOLDOUT',
    selectionPolicyHash: 'selection-v1',
    candidates: [
      { candidateId: 'A', receipt: receipt('T-A'), run: async () => ({ returns: returnsA }) },
      { candidateId: 'B', receipt: receipt('T-B'), run: async () => ({ returns: returnsB }) },
    ],
    policy: { blockCount: 4, maxPbo: 1, minDsr: 0 },
  });
}

const goodHoldout = async (): Promise<HoldoutSummary> => ({ resultClass: 'PASS', netExpectancy: 0.003, effectiveOosOpportunities: 240, maxDrawdown: 0.12, tailLoss: 0.08 });

test('controlled holdout requires a finalized, passing campaign and exact selected-candidate evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-holdout-boundary-'));
  try {
        const campaignLedger = new ResearchCampaignLedger(join(root, 'campaigns.jsonl'));
    const campaign = await campaignAt(root);
    const campaignFinal = await campaignLedger.getFinal('C-HO');
    if (!campaignFinal) throw new Error('CAMPAIGN_FINAL_MISSING_IN_TEST');
    const holdoutLedger = new HoldoutLedger(join(root, 'holdout.jsonl'), 'ROOT-HO', { global: 1, family: 1, lineage: 1 });
    const runner = new ControlledHoldoutRunner(campaignLedger, holdoutLedger);
    const reservation = { programRootId: 'ROOT-HO', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE' as const, units: 1, resultClass: 'PENDING' };
    const evidence = await runner.run({ campaignId: 'C-HO', selectedCandidateId: campaign.selectedCandidateId, researchProgramId: 'P-HOLDOUT', selectionPolicyHash: 'selection-v1', selectionEvidenceHash: campaign.evidenceHash, holdoutDatasetHash: 'a'.repeat(64), reservation, reservationId: 'R-HO' }, goodHoldout);
    assert.equal(evidence.summary.resultClass, 'PASS');
    assert.equal(evidence.selectedCandidateId, campaign.selectedCandidateId);
    const text = await readFile(join(root, 'holdout.jsonl'), 'utf8');
    assert.match(text, /"campaignId":"C-HO"/);
    assert.match(text, /"candidateId":"/);
    assert.match(text, /"selectionEvidenceHash":"[0-9a-f]{64}"/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('controlled holdout rejects candidate swap, evidence swap, and raw holdout payloads before consuming budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-holdout-attacks-'));
  try {
    const campaignLedger = new ResearchCampaignLedger(join(root, 'campaigns.jsonl'));
        const campaign = await campaignAt(root, 'C-HO2');
    const holdoutLedger = new HoldoutLedger(join(root, 'holdout.jsonl'), 'ROOT-HO2', { global: 2, family: 2, lineage: 2 });
    const runner = new ControlledHoldoutRunner(campaignLedger, holdoutLedger);
    const reservation = { programRootId: 'ROOT-HO2', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE' as const, units: 1, resultClass: 'PENDING' };
    await assert.rejects(() => runner.run({ campaignId: 'C-HO2', selectedCandidateId: campaign.selectedCandidateId === 'A' ? 'B' : 'A', researchProgramId: 'P-HOLDOUT', selectionPolicyHash: 'selection-v1', selectionEvidenceHash: campaign.evidenceHash, holdoutDatasetHash: 'b'.repeat(64), reservation, reservationId: 'R1' }, goodHoldout), /HOLDOUT_CANDIDATE_MISMATCH/);
    await assert.rejects(() => runner.run({ campaignId: 'C-HO2', selectedCandidateId: campaign.selectedCandidateId, researchProgramId: 'P-HOLDOUT', selectionPolicyHash: 'selection-v1', selectionEvidenceHash: 'b'.repeat(64), holdoutDatasetHash: 'b'.repeat(64), reservation, reservationId: 'R2' }, goodHoldout), /HOLDOUT_SELECTION_EVIDENCE_MISMATCH/);
    await assert.rejects(() => runner.run({ campaignId: 'C-HO2', selectedCandidateId: campaign.selectedCandidateId, researchProgramId: 'P-HOLDOUT', selectionPolicyHash: 'selection-v1', selectionEvidenceHash: campaign.evidenceHash, holdoutDatasetHash: 'b'.repeat(64), reservation: { ...reservation, units: 1 }, reservationId: 'R3' }, async () => ({ ...(await goodHoldout()), rawRows: [] } as unknown as HoldoutSummary)), /RAW_HOLDOUT_PAYLOAD_FORBIDDEN/);
    assert.equal(await holdoutLedger.consumed('GLOBAL'), 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('promotion evidence can only be built from the frozen campaign selection and a successful controlled holdout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-promotion-evidence-'));
  try {
    const campaignLedger = new ResearchCampaignLedger(join(root, 'campaigns.jsonl'));
    const campaign = await campaignAt(root, 'C-HO3');
    const campaignFinal = await campaignLedger.getFinal('C-HO3');
    if (!campaignFinal) throw new Error('CAMPAIGN_FINAL_MISSING_IN_TEST');
    const holdoutLedger = new HoldoutLedger(join(root, 'holdout.jsonl'), 'ROOT-HO3', { global: 1, family: 1, lineage: 1 });
    const runner = new ControlledHoldoutRunner(campaignLedger, holdoutLedger);
    const holdout = await runner.run({ campaignId: 'C-HO3', selectedCandidateId: campaign.selectedCandidateId, researchProgramId: 'P-HOLDOUT', selectionPolicyHash: 'selection-v1', selectionEvidenceHash: campaign.evidenceHash, holdoutDatasetHash: 'c'.repeat(64), reservation: { programRootId: 'ROOT-HO3', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 1, resultClass: 'PENDING' }, reservationId: 'R3' }, goodHoldout);
    const pkg = buildPromotionEvidencePackage(campaignFinal, holdout);
    assert.doesNotThrow(() => assertPromotionEvidencePackage(pkg));
    assert.throws(() => assertPromotionEvidencePackage({ ...pkg, holdoutEvidenceHash: 'd'.repeat(64) }), /PROMOTION_EVIDENCE_TAMPERED/);
    assert.throws(() => buildPromotionEvidencePackage({ ...campaignFinal, selectedCandidateId: 'OTHER' }, holdout), /PROMOTION_CANDIDATE_MISMATCH/);
    assert.throws(() => buildPromotionEvidencePackage(campaignFinal, { ...holdout, summary: { ...holdout.summary, resultClass: 'FAIL' } }), /HOLDOUT_NOT_PROMOTION_ELIGIBLE/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
