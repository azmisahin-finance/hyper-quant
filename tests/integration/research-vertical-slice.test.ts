import { mkdtemp, rm, readFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FeatureEngine, rollingZScoreFeature, type ResearchBar } from '../../src/research/features.js';
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
