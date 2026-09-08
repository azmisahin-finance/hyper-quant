import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLatencyProfile } from '../../src/execution/latency-model.js';
import { FeatureEngine, rollingZScoreFeature, type ResearchBar } from '../../src/research/features.js';
import { runFirstEvidenceCampaign, EVIDENCE_REPORT_INDEX, buildExecutionCostAndSlippageReport } from '../../src/research/evidence-reports.js';

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

test('RPT-05 deterministically models explicit fees, spread, latency, and adverse cost stress', () => {
  const latencyProfile = buildLatencyProfile('btc-try-latency', [
    { submitToVenueMs: 10, venueAckMs: 5, fillToBookMs: 5 },
    { submitToVenueMs: 20, venueAckMs: 5, fillToBookMs: 5 },
    { submitToVenueMs: 30, venueAckMs: 10, fillToBookMs: 5 },
  ]);
  const input = {
    campaignId: 'BTC-TRY-RPT-05-01',
    datasetHash: 'a'.repeat(64),
    datasetVersion: 'fixture-rpt-05',
    codeHash: 'b'.repeat(64),
    configHash: 'c'.repeat(64),
    notional: 100_000,
    turnover: 1,
    feeBps: 6,
    slippageBps: 9,
    spreadBps: 4,
    latencyProfile,
    stalenessMs: 25,
    partialFillRate: 0.3,
    rejectRate: 0.05,
    unknownInFlightCount: 0,
    stressMultiple: 1.5,
  };

  const first = buildExecutionCostAndSlippageReport(input);
  const repeat = buildExecutionCostAndSlippageReport(input);
  assert.ok(first.result);
  const result = first.result!;

  assert.equal(first.reportId, 'RPT-05');
  assert.equal(first.scope.mode, 'READ_ONLY_NON_LIVE');
  assert.equal(first.outcome, 'COMPLETED');
  assert.equal(first.resultHash, repeat.resultHash);
  assert.equal(first.evidenceHash, repeat.evidenceHash);
  assert.equal(result.lineage.datasetHash, input.datasetHash);
  assert.ok(result.totalCost > 0);
  assert.ok(result.adverseCostBps >= result.modeledCostBps);
  assert.equal(first.blockers, undefined);
});

test('RPT-05 blocks unsupported live authority and unknown in-flight realism', () => {
  const latencyProfile = buildLatencyProfile('btc-try-latency-b', [
    { submitToVenueMs: 8, venueAckMs: 3, fillToBookMs: 3 },
  ]);
  const blocked = buildExecutionCostAndSlippageReport({
    campaignId: 'BTC-TRY-RPT-05-02',
    datasetHash: 'd'.repeat(64),
    datasetVersion: 'fixture-rpt-05',
    codeHash: 'e'.repeat(64),
    configHash: 'f'.repeat(64),
    notional: 80_000,
    turnover: 1,
    feeBps: 5,
    slippageBps: 10,
    spreadBps: 3,
    latencyProfile,
    stalenessMs: 25,
    partialFillRate: 0.4,
    rejectRate: 0.1,
    unknownInFlightCount: 2,
    liveAuthority: true,
  });

  assert.equal(blocked.outcome, 'BLOCKED');
  assert.ok(blocked.blockers?.includes('LIVE_AUTHORITY_NOT_SUPPORTED'));
  assert.ok(blocked.blockers?.includes('UNKNOWN_IN_FLIGHT_OUTCOME_UNSUPPORTED'));
  assert.equal(blocked.result?.liveAuthority, false);
});

test('RPT-05 fails invalid parameter combinations and preserves explicit error codes', () => {
  const invalid = buildExecutionCostAndSlippageReport({
    campaignId: 'BTC-TRY-RPT-05-03',
    datasetHash: '1'.repeat(64),
    datasetVersion: 'fixture-rpt-05',
    codeHash: '2'.repeat(64),
    configHash: '3'.repeat(64),
    notional: -1,
    turnover: 1,
    feeBps: 5,
    slippageBps: 2,
    spreadBps: 0,
    latencyProfile: buildLatencyProfile('btc-try-latency-c', [{ submitToVenueMs: 1, venueAckMs: 1, fillToBookMs: 1 }]),
    stalenessMs: 0,
    partialFillRate: 0.2,
    rejectRate: 0.1,
    unknownInFlightCount: 0,
  });

  assert.equal(invalid.outcome, 'FAIL');
  assert.equal(invalid.errorCode, 'INVALID_NOTIONAL');
});

test('RPT-05 rejects stale latency beyond supported realism and exposes blockers', () => {
  const stale = buildExecutionCostAndSlippageReport({
    campaignId: 'BTC-TRY-RPT-05-04',
    datasetHash: '4'.repeat(64),
    datasetVersion: 'fixture-rpt-05',
    codeHash: '5'.repeat(64),
    configHash: '6'.repeat(64),
    notional: 50_000,
    turnover: 1,
    feeBps: 4,
    slippageBps: 6,
    spreadBps: 2,
    latencyProfile: buildLatencyProfile('btc-try-latency-d', [{ submitToVenueMs: 5, venueAckMs: 5, fillToBookMs: 5 }]),
    stalenessMs: 61,
    partialFillRate: 0.1,
    rejectRate: 0.05,
    unknownInFlightCount: 0,
  });

  assert.equal(stale.outcome, 'BLOCKED');
  assert.ok(stale.blockers?.includes('STALE_LATENCY_OUTCOME_UNSUPPORTED'));
});
