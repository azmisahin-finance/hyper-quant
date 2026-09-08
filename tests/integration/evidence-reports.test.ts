import test from 'node:test';
import assert from 'node:assert/strict';
import { FeatureEngine, rollingZScoreFeature, type ResearchBar } from '../../src/research/features.js';
import { runFirstEvidenceCampaign, EVIDENCE_REPORT_INDEX } from '../../src/research/evidence-reports.js';

function bars(count = 40): ResearchBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + Math.sin(index / 2) * 2 + index * 0.05;
    return { timestampMs: 1_700_000_000_000 + index * 60_000, open: close - 0.1, high: close + 0.5, low: close - 0.5, close, volume: 10 + index };
  });
}

function input(overrides: Partial<Parameters<typeof runFirstEvidenceCampaign>[0]> = {}) {
  return {
    campaignId: 'BTC-TRY-BASELINE-01',
    datasetHash: 'dataset-hash',
    datasetVersion: 'fixture-1',
    codeHash: 'code-hash',
    configHash: 'config-hash',
    bars: bars(),
    featureId: 'zscore',
    lookback: 5,
    entryZ: 0.8,
    exitZ: 0.2,
    backtest: { initialCapital: 1_000, latencyBars: 0, costs: { feeBps: 2, slippageBps: 3 } },
    ...overrides,
  };
}

test('RPT-01 and RPT-02 bind identity, lineage, scope, and deterministic input hashes', () => {
  const first = runFirstEvidenceCampaign(input());
  const repeat = runFirstEvidenceCampaign(input());
  assert.equal(first.baseline.reportId, 'RPT-01');
  assert.equal(first.reproducibility.reportId, 'RPT-02');
  assert.equal(first.baseline.scope.venue, 'BtcTurk');
  assert.equal(first.baseline.scope.market, 'BTC/TRY');
  assert.equal(first.baseline.scope.mode, 'READ_ONLY_NON_LIVE');
  assert.match(first.baseline.inputHash, /^[0-9a-f]{64}$/);
  assert.equal(first.baseline.inputHash, repeat.baseline.inputHash);
  assert.equal(first.baseline.resultHash, repeat.baseline.resultHash);
  assert.equal(first.reproducibility.reproducible, true);
  assert.equal(first.reproducibility.lineage.datasetHash, 'dataset-hash');
});

test('baseline reports a valid NO_TRADE outcome without claiming profitability', () => {
  const result = runFirstEvidenceCampaign(input({ bars: bars(3), lookback: 5 }));
  assert.equal(result.baseline.outcome, 'NO_TRADE');
  assert.equal(result.baseline.backtest?.tradeCount, 0);
  assert.equal(result.reproducibility.reproducible, true);
});

test('invalid market data produces a durable FAIL report and non-reproducible certificate', () => {
  const invalid = bars();
  invalid[3] = { ...invalid[3], close: Number.NaN };
  const result = runFirstEvidenceCampaign(input({ bars: invalid }));
  assert.equal(result.baseline.outcome, 'FAIL');
  assert.equal(result.baseline.errorCode, 'NON_FINITE_MARKET_VALUE');
  assert.equal(result.reproducibility.reproducible, false);
});

test('report index preserves the exact RPT-01 through RPT-12 register', () => {
  assert.deepEqual(EVIDENCE_REPORT_INDEX.map((entry) => entry.reportId), Array.from({ length: 12 }, (_, index) => `RPT-${String(index + 1).padStart(2, '0')}`));
});
