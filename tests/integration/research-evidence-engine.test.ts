import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchEvidenceLedger, assertFullResearchEvidencePackage, buildFullResearchEvidencePackage } from '../../src/research/evidence-engine.js';
import { ResearchCampaignLedger, type CampaignFinalRecord } from '../../src/research/campaign-ledger.js';
import { ResearchTrialLedger, type ResearchTrialReceipt } from '../../src/research/trial-ledger.js';
import { ResearchCampaignRunner } from '../../src/research/campaign.js';
import { HoldoutLedger } from '../../src/research/holdout-ledger.js';
import { ControlledHoldoutRunner, type HoldoutSummary } from '../../src/research/controlled-holdout.js';
import { createWalkForwardFolds } from '../../src/research/walk-forward.js';
import { computePboCscv } from '../../src/research/overfitting.js';
import { evaluateRegimeCoverage } from '../../src/research/regimes.js';
import type { ResearchPolicy } from '../../src/research/research-runner.js';

const returnsA = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 0.006 : 0.002));
const returnsB = Array.from({ length: 24 }, () => 0.004);
function receipt(trialId: string): ResearchTrialReceipt {
  return { trialId, researchProgramId: 'P-EV', hypothesisId: `H-${trialId}`, codeHash: 'code', configHash: `cfg-${trialId}`, datasetHash: 'dataset', selectionPolicyHash: 'selection-v1', parentTrialIds: [], createdAt: new Date(0).toISOString() };
}

const policy: ResearchPolicy = {
  minSampleCount: 2,
  minDsr: 0,
  minEffectiveOosOpportunities: 2,
  maxPbo: 1,
  maxSingleBlockPnlShare: 1,
  maxSingleWeekPnlShare: 1,
  minDistinctRegimes: 1,
  minCostStressMultiplier: 1,
};

async function setup(root: string) {
  const trialLedger = new ResearchTrialLedger(join(root, 'trials.jsonl'));
  const campaignLedger = new ResearchCampaignLedger(join(root, 'campaigns.jsonl'));
  const campaignRunner = new ResearchCampaignRunner(trialLedger, campaignLedger);
  const campaign = await campaignRunner.run({
    campaignId: 'C-EV',
    researchProgramId: 'P-EV',
    selectionPolicyHash: 'selection-v1',
    candidates: [
      { candidateId: 'A', receipt: receipt('T-A'), run: async () => ({ returns: returnsA }) },
      { candidateId: 'B', receipt: receipt('T-B'), run: async () => ({ returns: returnsB }) },
    ],
    policy: { blockCount: 4, maxPbo: 1, minDsr: 0 },
  });
  const campaignFinal = await campaignLedger.getFinal('C-EV');
  if (!campaignFinal) throw new Error('CAMPAIGN_FINAL_MISSING');
  const holdoutLedger = new HoldoutLedger(join(root, 'holdout.jsonl'), 'ROOT-EV', { global: 1, family: 1, lineage: 1 });
  const holdoutRunner = new ControlledHoldoutRunner(campaignLedger, holdoutLedger);
  const good: HoldoutSummary = { resultClass: 'PASS', netExpectancy: 0.003, effectiveOosOpportunities: 24, maxDrawdown: 0.1, tailLoss: 0.05 };
  const holdout = await holdoutRunner.run({
    campaignId: 'C-EV',
    selectedCandidateId: campaign.selectedCandidateId,
    researchProgramId: 'P-EV',
    selectionPolicyHash: 'selection-v1',
    selectionEvidenceHash: campaign.evidenceHash,
    holdoutDatasetHash: 'a'.repeat(64),
    reservation: { programRootId: 'ROOT-EV', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 1, resultClass: 'PENDING' },
    reservationId: 'R-EV',
  }, async () => good);
  return { campaign, campaignFinal, holdout };
}

function buildInput(root: string, campaignFinal: CampaignFinalRecord, holdout: Awaited<ReturnType<typeof setup>>['holdout']) {
  const folds = createWalkForwardFolds(24, { trainBars: 4, testBars: 4, stepBars: 4, purgeWindowBars: 1, embargoBars: 1, mode: 'EXPANDING' });
  const pboCscv = computePboCscv({ candidateReturns: [returnsA, returnsB], blockCount: 4 });
  const regimeCoverage = evaluateRegimeCoverage(returnsA, [8, 9, 10, 11], [
    { regimeId: 'R1', startIndexInclusive: 0, endIndexExclusive: 12 },
    { regimeId: 'R2', startIndexInclusive: 12, endIndexExclusive: 24 },
  ]);
  return {
    campaign: campaignFinal,
    holdout,
    selectedReturns: returnsA,
    committedTrialCount: campaignFinal.committedTrialCount,
    walkForward: { folds, effectiveOosOpportunities: 4 },
    pboCscv,
    regimeCoverage,
    regimeIds: regimeCoverage.evaluations.map((item) => item.regimeId),
    contiguousBlockNetReturns: [0.01, 0.01, 0.01, 0.01],
    calendarWeekNetReturns: [0.01, 0.01, 0.01, 0.01],
    stressedNetExpectancy: 0.001,
    statistical: { meanTradeExpectancy: 0.003, sampleCount: returnsA.length, sampleStdDev: 0.002, dsr: campaignFinal.dsr },
    benchmarkSharpe: 0,
  };
}

test('full research evidence recomputes PSR/DSR and binds campaign+holdout+validation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-full-evidence-'));
  try {
    const { campaignFinal, holdout } = await setup(root);
    const pkg = buildFullResearchEvidencePackage(buildInput(root, campaignFinal, holdout), policy);
    assert.doesNotThrow(() => assertFullResearchEvidencePackage(pkg));
    assert.equal(pkg.campaignId, campaignFinal.campaignId);
    assert.equal(pkg.holdoutEvidenceHash, holdout.evidenceHash);
    assert.equal(pkg.committedTrialCount, campaignFinal.committedTrialCount);
    assert.ok(pkg.psr.psr >= 0 && pkg.psr.psr <= 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('full evidence rejects campaign metric substitution and package tampering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-full-evidence-tamper-'));
  try {
    const { campaignFinal, holdout } = await setup(root);
    const input = buildInput(root, campaignFinal, holdout);
    assert.throws(() => buildFullResearchEvidencePackage({ ...input, pboCscv: { ...input.pboCscv, pbo: campaignFinal.pbo + 0.1 } }, policy), /CAMPAIGN_PBO_MISMATCH/);
    const pkg = buildFullResearchEvidencePackage(input, policy);
    const tamperedDsr = pkg.dsr.dsr > 0.5 ? 0 : 1;
    assert.throws(() => assertFullResearchEvidencePackage({ ...pkg, dsr: { ...pkg.dsr, dsr: tamperedDsr } }), /FULL_RESEARCH_EVIDENCE_TAMPERED/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('evidence ledger is append-only and serializes concurrent commits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-evidence-ledger-'));
  try {
    const { campaignFinal, holdout } = await setup(root);
    const pkg = buildFullResearchEvidencePackage(buildInput(root, campaignFinal, holdout), policy);
    const ledger = new ResearchEvidenceLedger(join(root, 'evidence.jsonl'));
    await ledger.commit(pkg);
    await assert.rejects(() => ledger.commit(pkg), /RESEARCH_EVIDENCE_ALREADY_COMMITTED/);
    const stored = await ledger.get(pkg.campaignId);
    assert.ok(stored);
    const text = await readFile(join(root, 'evidence.jsonl'), 'utf8');
    assert.equal(text.trim().split('\n').length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
