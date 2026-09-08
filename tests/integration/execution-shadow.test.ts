import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImpactModel, interpolateImpactBps } from '../../src/execution/impact-model.js';
import { buildLatencyProfile, chooseLatencyMs } from '../../src/execution/latency-model.js';
import { DeterministicShadowExecutor } from '../../src/execution/shadow-execution.js';

test('execution realism: latency profile is deterministic and preserves p50/p90/p99 ordering', () => {
  const p = buildLatencyProfile('p1', [
    { submitToVenueMs: 10, venueAckMs: 5, fillToBookMs: 5 },
    { submitToVenueMs: 20, venueAckMs: 5, fillToBookMs: 5 },
    { submitToVenueMs: 40, venueAckMs: 10, fillToBookMs: 5 },
  ]);
  assert.equal(chooseLatencyMs(p, 0), 20);
  assert.ok(p.quantilesMs.p50 <= p.quantilesMs.p90);
  assert.ok(p.quantilesMs.p90 <= p.quantilesMs.p99);
  assert.equal(p.profileHash, buildLatencyProfile('p1', p.observations).profileHash);
});

test('execution realism: latency rejects negative observations', () => {
  assert.throws(() => buildLatencyProfile('bad', [{ submitToVenueMs: -1, venueAckMs: 0, fillToBookMs: 0 }]), /INVALID_LATENCY_OBSERVATION/);
});

test('execution realism: impact calibration must be monotonic and interpolates deterministically', () => {
  const model = buildImpactModel('impact-1', [
    { participationRate: 0, impactBps: 0 },
    { participationRate: 0.5, impactBps: 8 },
    { participationRate: 1, impactBps: 20 },
  ]);
  assert.equal(interpolateImpactBps(model, 0.25), 4);
  assert.equal(interpolateImpactBps(model, 0.75), 14);
  assert.throws(() => buildImpactModel('bad', [
    { participationRate: 0, impactBps: 5 },
    { participationRate: 1, impactBps: 4 },
  ]), /NON_MONOTONIC_IMPACT_CURVE/);
});

test('execution realism: shadow decision cannot be observed before modeled arrival', () => {
  const latency = buildLatencyProfile('p', [{ submitToVenueMs: 10, venueAckMs: 5, fillToBookMs: 5 }]);
  const shadow = new DeterministicShadowExecutor('s1', latency);
  const decision = shadow.recordDecision({ decisionId: 'd1', orderId: 'o1', symbol: 'BTCUSDT', side: 'BUY', quantity: 1, decisionTimeMs: 1000, latencySampleIndex: 0, strategyArtifactHash: 'artifact' });
  assert.equal(decision.expectedArrivalMs, 1020);
  assert.throws(() => shadow.observe({ decisionId: 'd1', observedAtMs: 1019, actionability: 'UNKNOWN' }), /OBSERVATION_BEFORE_EXPECTED_ARRIVAL/);
});

test('execution realism: actionable shadow observation requires side-specific quote', () => {
  const latency = buildLatencyProfile('p', [{ submitToVenueMs: 0, venueAckMs: 0, fillToBookMs: 0 }]);
  const shadow = new DeterministicShadowExecutor('s2', latency);
  shadow.recordDecision({ decisionId: 'd2', orderId: 'o2', symbol: 'BTCUSDT', side: 'SELL', quantity: 1, decisionTimeMs: 10, latencySampleIndex: 0, strategyArtifactHash: 'artifact' });
  assert.throws(() => shadow.observe({ decisionId: 'd2', observedAtMs: 10, actionability: 'ACTIONABLE' }), /ACTIONABLE_SELL_REQUIRES_BID/);
  shadow.observe({ decisionId: 'd2', observedAtMs: 10, actionability: 'ACTIONABLE', observedBid: 100 });
  assert.equal(shadow.result().observations.length, 1);
});

test('execution realism: shadow session result is deterministic and immutable by copy', () => {
  const latency = buildLatencyProfile('p', [{ submitToVenueMs: 1, venueAckMs: 1, fillToBookMs: 1 }]);
  const shadow = new DeterministicShadowExecutor('s3', latency);
  shadow.recordDecision({ decisionId: 'd3', orderId: 'o3', symbol: 'BTCUSDT', side: 'BUY', quantity: 2, decisionTimeMs: 100, latencySampleIndex: 0, strategyArtifactHash: 'artifact' });
  shadow.observe({ decisionId: 'd3', observedAtMs: 103, actionability: 'ACTIONABLE', observedAsk: 101 });
  const a = shadow.result();
  const b = shadow.result();
  assert.equal(a.sessionHash, b.sessionHash);
  assert.notEqual(a.decisions, shadow['decisions']);
});
