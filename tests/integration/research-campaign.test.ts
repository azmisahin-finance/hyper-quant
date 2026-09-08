import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchTrialLedger } from '../../src/research/trial-ledger.js';
import { ResearchCampaignLedger } from '../../src/research/campaign-ledger.js';
import { ResearchCampaignRunner } from '../../src/research/campaign.js';

function receipt(trialId: string) {
  return { trialId, researchProgramId: 'P-CAMPAIGN', hypothesisId: `H-${trialId}`, codeHash: 'code', configHash: `cfg-${trialId}`, datasetHash: 'dataset', selectionPolicyHash: 'selection-v1', parentTrialIds: [], createdAt: new Date(0).toISOString() };
}

const returnsA = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 0.006 : 0.002));
const returnsB = Array.from({ length: 24 }, (_, i) => (i < 12 ? 0.009 : 0.004));

 test('research campaign registers every candidate, derives trial count, and finalizes deterministic selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-campaign-'));
  try {
    const trialLedger = new ResearchTrialLedger(join(root, 'trials.jsonl'));
    const campaignLedger = new ResearchCampaignLedger(join(root, 'campaigns.jsonl'));
    const runner = new ResearchCampaignRunner(trialLedger, campaignLedger);
    const result = await runner.run({
      campaignId: 'C1',
      researchProgramId: 'P-CAMPAIGN',
      selectionPolicyHash: 'selection-v1',
      candidates: [
        { candidateId: 'A', receipt: receipt('T-A'), run: async () => ({ returns: returnsA }) },
        { candidateId: 'B', receipt: receipt('T-B'), run: async () => ({ returns: returnsB }) },
      ],
      policy: { blockCount: 4, maxPbo: 1, minDsr: 0 },
    });
    assert.equal(result.committedTrialCount, 2);
    assert.equal(result.selectedCandidateId, 'B');
    assert.equal(result.diagnostics.dsr.committedTrialCount, 2);
    assert.equal(result.passedSelectionGates, true);
    assert.match(result.evidenceHash, /^[0-9a-f]{64}$/);
    assert.equal(await campaignLedger.isFinal('C1'), true);
    const ledgerText = await readFile(join(root, 'campaigns.jsonl'), 'utf8');
    assert.match(ledgerText, /CAMPAIGN_START/);
    assert.match(ledgerText, /CAMPAIGN_FINAL/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('research campaign rejects duplicate candidate identity before any trial starts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-campaign-duplicate-'));
  try {
    const runner = new ResearchCampaignRunner(new ResearchTrialLedger(join(root, 'trials.jsonl')), new ResearchCampaignLedger(join(root, 'campaigns.jsonl')));
    await assert.rejects(() => runner.run({
      campaignId: 'C2',
      researchProgramId: 'P-CAMPAIGN',
      selectionPolicyHash: 'selection-v1',
      candidates: [
        { candidateId: 'A', receipt: receipt('T-A2'), run: async () => ({ returns: returnsA }) },
        { candidateId: 'A', receipt: receipt('T-B2'), run: async () => ({ returns: returnsB }) },
      ],
      policy: { blockCount: 4, maxPbo: 1, minDsr: 0 },
    }), /DUPLICATE_CAMPAIGN_CANDIDATE/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('research campaign crash is durably recorded and prevents false campaign finalization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-campaign-crash-'));
  try {
    const trialLedger = new ResearchTrialLedger(join(root, 'trials.jsonl'));
    const campaignLedger = new ResearchCampaignLedger(join(root, 'campaigns.jsonl'));
    const runner = new ResearchCampaignRunner(trialLedger, campaignLedger);
    await assert.rejects(() => runner.run({
      campaignId: 'C3',
      researchProgramId: 'P-CAMPAIGN',
      selectionPolicyHash: 'selection-v1',
      candidates: [
        { candidateId: 'A', receipt: receipt('T-A3'), run: async () => ({ returns: returnsA }) },
        { candidateId: 'B', receipt: receipt('T-B3'), run: async () => { throw new Error('SIMULATED_CAMPAIGN_CRASH'); } },
      ],
      policy: { blockCount: 4, maxPbo: 1, minDsr: 0 },
    }), /SIMULATED_CAMPAIGN_CRASH/);
    assert.equal(await campaignLedger.isFinal('C3'), false);
    assert.equal(await trialLedger.countRegisteredTrials('P-CAMPAIGN'), 2);
    const trialText = await readFile(join(root, 'trials.jsonl'), 'utf8');
    assert.match(trialText, /"outcome":"CRASHED"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
