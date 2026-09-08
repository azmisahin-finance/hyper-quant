import { mkdtemp, rm, readFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FeatureEngine, rollingZScoreFeature, type ResearchBar } from '../../src/research/features.js';
import { ResearchRunner, validateResearchEvidenceForPromotion, type ResearchPolicy } from '../../src/research/research-runner.js';
import { ResearchTrialLedger, type ResearchTrialReceipt } from '../../src/research/trial-ledger.js';
import { buildArtifactIdentityChain } from '../../src/research/artifact-identity.js';
import { createPurgedSplit } from '../../src/research/timeseries.js';
import { runDeterministicBacktest, createZScoreMeanReversionStrategy } from '../../src/research/backtest.js';

function bars(count = 30): ResearchBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + Math.sin(index / 2) * 2 + index * 0.05;
    return { timestampMs: 1_700_000_000_000 + index * 60_000, open: close - 0.1, high: close + 0.5, low: close - 0.5, close, volume: 10 + index };
  });
}

test('research vertical slice: feature rows cannot receive future bars', () => {
  const engine = new FeatureEngine([rollingZScoreFeature('zscore_5', 5)]);
  const result = engine.evaluate(bars());
  assert.equal(result[5].index, 5);
  assert.equal(result[5].availableAtMs, result[5].decisionTimeMs);
  assert.equal(Number.isFinite(result[5].values.zscore_5), true);
});

test('research vertical slice: non-monotonic market data is rejected', () => {
  const input = bars();
  input[8].timestampMs = input[7].timestampMs;
  const engine = new FeatureEngine([rollingZScoreFeature('zscore_5', 5)]);
  assert.throws(() => engine.evaluate(input), /NON_MONOTONIC_TIME/);
});

test('research vertical slice: purge and embargo are hard boundaries', () => {
  const split = createPurgedSplit(100, { trainEndIndexExclusive: 50, testStartIndex: 60, purgeWindowBars: 6, embargoBars: 4 });
  assert.equal(split.trainIndices.at(-1), 49);
  assert.deepEqual(split.purgedIndices, [50, 51, 52, 53, 54, 55]);
  assert.deepEqual(split.embargoedIndices, [56, 57, 58, 59]);
  assert.equal(split.testIndices[0], 60);
  assert.throws(() => createPurgedSplit(100, { trainEndIndexExclusive: 50, testStartIndex: 55, purgeWindowBars: 6, embargoBars: 4 }), /PURGE_EMBARGO_VIOLATION/);
});

test('research vertical slice: baseline backtest is deterministic and costs reduce equity', () => {
  const data = bars(80);
  const engine = new FeatureEngine([rollingZScoreFeature('zscore_8', 8)]);
  const features = engine.evaluate(data);
  const strategy = createZScoreMeanReversionStrategy('zscore_8', 0.8, 0.1);
  const base = runDeterministicBacktest(data, features, strategy, { initialCapital: 10_000, latencyBars: 0, costs: { feeBps: 0, slippageBps: 0 } });
  const costly = runDeterministicBacktest(data, features, strategy, { initialCapital: 10_000, latencyBars: 0, costs: { feeBps: 5, slippageBps: 5 } });
  const repeat = runDeterministicBacktest(data, features, strategy, { initialCapital: 10_000, latencyBars: 0, costs: { feeBps: 5, slippageBps: 5 } });
  assert.equal(repeat.resultHash, costly.resultHash);
  assert.equal(costly.finalCapital <= base.finalCapital, true);
  for (const trade of costly.trades) assert.equal(trade.executionIndex > trade.signalIndex, true);
});

test('research vertical slice: execution latency delays signal application', () => {
  const data = bars(20);
  const engine = new FeatureEngine([rollingZScoreFeature('z', 3)]);
  const features = engine.evaluate(data);
  const strategy = createZScoreMeanReversionStrategy('z', 0.5, 0.1);
  const result = runDeterministicBacktest(data, features, strategy, { initialCapital: 1_000, latencyBars: 2, costs: { feeBps: 0, slippageBps: 0 } });
  for (const trade of result.trades) assert.equal(trade.executionIndex, trade.signalIndex + 3);
});

test('research vertical slice: result is pure enough for receipt binding', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'hq-research-'));
  try {
    const data = bars(40);
    const features = new FeatureEngine([rollingZScoreFeature('z', 5)]).evaluate(data);
    const strategy = createZScoreMeanReversionStrategy('z', 0.8, 0.2);
    const result = runDeterministicBacktest(data, features, strategy, { initialCapital: 1000, latencyBars: 0, costs: { feeBps: 2, slippageBps: 3 } });
    const file = join(temp, 'result.json');
    await readFile(file).catch(() => undefined);
    await appendFile(file, JSON.stringify(result), 'utf8');
    const loaded = JSON.parse(await readFile(file, 'utf8')) as typeof result;
    assert.equal(loaded.resultHash, result.resultHash);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});


function researchPolicy(): ResearchPolicy {
  return { minSampleCount: 200, minDsr: 0.95, minEffectiveOosOpportunities: 200, maxPbo: 0.10, maxSingleBlockPnlShare: 0.50, maxSingleWeekPnlShare: 0.50, minDistinctRegimes: 3, minCostStressMultiplier: 1.5 };
}

function receipt(id: string): ResearchTrialReceipt {
  return { trialId: id, researchProgramId: 'P1', hypothesisId: 'H1', codeHash: 'code', configHash: 'config', datasetHash: 'dataset', selectionPolicyHash: 'selection', parentTrialIds: [], createdAt: new Date(0).toISOString() };
}

function artifact(): ReturnType<typeof buildArtifactIdentityChain> {
  return buildArtifactIdentityChain({ sourceTreeHash: 'a', artifactHash: 'b', manifestHash: 'c', dependencyLockHash: 'd', dependencyGraphHash: 'e', buildEnvironmentHash: 'f', executableArtifactHash: 'g' });
}

test('research governance: runner registers receipt before compute and counts committed trials', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'hq-runner-'));
  try {
    const ledger = new ResearchTrialLedger(join(temp, 'trials.jsonl'));
    const runner = new ResearchRunner(ledger, researchPolicy());
    let computeSawReceipt = false;
    const result = await runner.run({ receipt: receipt('T1'), featureNodes: [{ id: 'z', inputs: ['close'], lookback: 5, labelHorizon: 1 }], declaredLookback: 5, artifactExpected: artifact(), artifactExecuted: artifact(), holdout: false }, async () => {
      computeSawReceipt = await ledger.hasReceipt('T1');
      return { value: 7, evidence: { effectiveOosOpportunities: 200, pbo: 0.05, contiguousBlockNetReturns: [1, 1, 1, 1], calendarWeekNetReturns: [1, 1, 1, 1], regimeIds: ['R1', 'R2', 'R3'], stressedNetExpectancy: 1, statistical: { meanTradeExpectancy: 1, sampleCount: 200, sampleStdDev: 1, dsr: 0.99 } } };
    });
    assert.equal(computeSawReceipt, true);
    assert.equal(result.outcome, 'PASS');
    assert.equal(result.trialCountAtCompletion, 1);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('research governance: statistical trial count comes from committed ledger, not analyst input', async () => {
  const decision = validateResearchEvidenceForPromotion(
    { effectiveOosOpportunities: 200, pbo: 0.05, contiguousBlockNetReturns: [1, 1], calendarWeekNetReturns: [1, 1], regimeIds: ['R1', 'R2', 'R3'], stressedNetExpectancy: 1, statistical: { meanTradeExpectancy: 1, sampleCount: 200, sampleStdDev: 1, dsr: 0.99 } },
    researchPolicy(),
    2,
  );
  assert.equal(decision.pass, true);
});


test('research governance: holdout reservation consumes budget before compute', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'hq-holdout-reserve-'));
  try {
    const { HoldoutLedger } = await import('../../src/research/holdout-ledger.js');
    const holdout = new HoldoutLedger(join(temp, 'holdout.jsonl'), 'ROOT-1', { global: 1, family: 1, lineage: 1 });
    await holdout.reserve({ programRootId: 'ROOT-1', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 1, resultClass: 'INCONCLUSIVE' }, 'R1');
    await assert.rejects(() => holdout.reserve({ programRootId: 'ROOT-1', familyId: 'F1', lineageId: 'L1', scope: 'LINEAGE', units: 1, resultClass: 'INCONCLUSIVE' }, 'R2'), /GLOBAL_HOLDOUT_BUDGET_EXCEEDED/);
    await holdout.finalizeReservation('R1', 'PASS');
    assert.equal(await holdout.consumed('GLOBAL'), 1);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('research governance: failed compute produces a durable CRASHED outcome', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'hq-runner-crash-'));
  try {
    const ledger = new ResearchTrialLedger(join(temp, 'trials.jsonl'));
    const runner = new ResearchRunner(ledger, researchPolicy());
    await assert.rejects(() => runner.run({ receipt: receipt('T-CRASH'), featureNodes: [{ id: 'z', inputs: ['close'], lookback: 1, labelHorizon: 1 }], declaredLookback: 1, artifactExpected: artifact(), artifactExecuted: artifact(), holdout: false }, async () => { throw new Error('COMPUTE_FAILED'); }), /COMPUTE_FAILED/);
    const records = (await readFile(join(temp, 'trials.jsonl'), 'utf8')).trim().split('\n').map((line: string) => JSON.parse(line) as { kind: string; outcome?: string });
    assert.equal(records.at(-1)?.kind, 'TRIAL_OUTCOME');
    assert.equal(records.at(-1)?.outcome, 'CRASHED');
  } finally { await rm(temp, { recursive: true, force: true }); }
});
