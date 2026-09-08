import test from 'node:test';
import assert from 'node:assert/strict';
import { VenueConvergenceEngine, captureRestConvergenceSnapshot, type RestConvergenceSnapshot } from '../../src/execution/venue-convergence.js';
import type { VenueAdapter, VenueOrder } from '../../src/venues/types.js';

function order(overrides: Partial<VenueOrder> = {}): VenueOrder {
  return {
    orderId: 'O-1', clientOrderId: 'C-1', symbol: 'BTCTRY', side: 'BUY', method: 'LIMIT', status: 'Open',
    quantity: 5, filledQuantity: 0, remainingQuantity: 5, createdAtMs: 10, updatedAtMs: 1000,
    ...overrides,
  };
}

function snapshot(capturedAtMs: number, openOrders: readonly VenueOrder[] = [order()]): RestConvergenceSnapshot {
  return {
    capturedAtMs,
    account: {
      venueId: 'btcturk', asOfMs: capturedAtMs,
      balances: [{ asset: 'TRY', total: 1000, free: 500, locked: 500, timestampMs: capturedAtMs }],
    },
    openOrders,
  };
}

test('REST bootstrap plus exact private order update produces a deterministic active-order convergence report', () => {
  const engine = new VenueConvergenceEngine('btcturk');
  engine.bootstrap(snapshot(1000));
  engine.observePrivateEvent({ kind: 'ORDER_UPDATE', order: order({ status: 'Partial', filledQuantity: 1, remainingQuantity: 4, updatedAtMs: 1001 }) });

  const finalRest = snapshot(1002, [order({ status: 'Partial', filledQuantity: 1, remainingQuantity: 4, updatedAtMs: 1001 })]);
  const first = engine.finalize(finalRest);
  const second = engine.finalize(finalRest);

  assert.equal(first.status, 'CONVERGED');
  assert.equal(first.accountStateSource, 'REST_ANCHOR_ONLY');
  assert.equal(first.activeOrderScope, 'REST_OPEN_ORDERS_ACTIVE_ONLY');
  assert.equal(first.privateObservationCount, 1);
  assert.equal(first.diffs.length, 0);
  assert.equal(first.reportHash, second.reportHash);
  assert.deepEqual(first.diffs, second.diffs);
});

test('a private trade is evidence only and must be exactly corroborated by a later REST active-order snapshot', () => {
  const engine = new VenueConvergenceEngine('btcturk');
  engine.bootstrap(snapshot(1000));
  engine.observePrivateEvent({
    kind: 'USER_TRADE', tradeId: 'T-1', orderId: 'O-1', symbol: 'BTCTRY', amount: 1, fee: 0, tax: 0, price: 100,
    side: 'BUY', clientOrderId: 'C-1', timestampMs: 1001,
  });
  const report = engine.finalize(snapshot(1002, [order({ status: 'Partial', filledQuantity: 1, remainingQuantity: 4, updatedAtMs: 1001 })]));
  assert.equal(report.status, 'CONVERGED');

  const incomplete = new VenueConvergenceEngine('btcturk');
  incomplete.bootstrap(snapshot(1000));
  incomplete.observePrivateEvent({
    kind: 'USER_TRADE', tradeId: 'T-1', orderId: 'O-1', symbol: 'BTCTRY', amount: 1, fee: 0, tax: 0, price: 100,
    side: 'BUY', clientOrderId: 'C-1', timestampMs: 1001,
  });
  const rejected = incomplete.finalize(snapshot(1002, [order({ status: 'Partial', filledQuantity: 2, remainingQuantity: 3, updatedAtMs: 1001 })]));
  assert.equal(rejected.status, 'DIVERGED');
  assert.equal(rejected.diffs.some((diff) => diff.kind === 'ORDER_QUANTITY_MISMATCH'), true);
});

test('an exact private order update does not authorize a later unproven REST quantity change', () => {
  const engine = new VenueConvergenceEngine('btcturk');
  engine.bootstrap(snapshot(1000));
  engine.observePrivateEvent({ kind: 'ORDER_UPDATE', order: order({ status: 'Partial', filledQuantity: 1, remainingQuantity: 4, updatedAtMs: 1001 }) });
  engine.observePrivateEvent({
    kind: 'USER_TRADE', tradeId: 'T-1', orderId: 'O-1', symbol: 'BTCTRY', amount: 1, fee: 0, tax: 0, price: 100,
    side: 'BUY', clientOrderId: 'C-1', timestampMs: 1002,
  });
  const report = engine.finalize(snapshot(1003, [order({ status: 'Partial', filledQuantity: 2, remainingQuantity: 3, updatedAtMs: 1003 })]));
  assert.equal(report.status, 'DIVERGED');
  assert.equal(report.diffs.some((diff) => diff.kind === 'ORDER_QUANTITY_MISMATCH'), true);
});

test('duplicate trade evidence is fail-closed and repeated finalization does not duplicate the diff', () => {
  const engine = new VenueConvergenceEngine('btcturk');
  engine.bootstrap(snapshot(1000));
  const trade = {
    kind: 'USER_TRADE' as const, tradeId: 'T-duplicate', orderId: 'O-1', symbol: 'BTCTRY', amount: 1, fee: 0, tax: 0, price: 100,
    side: 'BUY' as const, clientOrderId: 'C-1', timestampMs: 1001,
  };
  engine.observePrivateEvent(trade);
  engine.observePrivateEvent(trade);
  const first = engine.finalize(snapshot(1002));
  const second = engine.finalize(snapshot(1002));

  assert.equal(first.status, 'DIVERGED');
  assert.equal(first.diffs.filter((diff) => diff.kind === 'TRADE_ID_DUPLICATE').length, 1);
  assert.deepEqual(first.diffs, second.diffs);
  assert.equal(first.reportHash, second.reportHash);
});

test('private observations require exact identity and non-regressing venue timestamps', () => {
  const wrongIdentity = new VenueConvergenceEngine('btcturk');
  wrongIdentity.bootstrap(snapshot(1000));
  wrongIdentity.observePrivateEvent({ kind: 'ORDER_UPDATE', order: order({ clientOrderId: 'C-other', updatedAtMs: 1001 }) });
  const identityReport = wrongIdentity.finalize(snapshot(1002));
  assert.equal(identityReport.status, 'DIVERGED');
  assert.equal(identityReport.diffs.some((diff) => diff.kind === 'ORDER_IDENTITY_MISMATCH'), true);

  const staleTime = new VenueConvergenceEngine('btcturk');
  staleTime.bootstrap(snapshot(1000));
  staleTime.observePrivateEvent({
    kind: 'USER_TRADE', tradeId: 'T-stale', orderId: 'O-1', symbol: 'BTCTRY', amount: 1, fee: 0, tax: 0, price: 100,
    side: 'BUY', clientOrderId: 'C-1', timestampMs: 999,
  });
  const timeReport = staleTime.finalize(snapshot(1002));
  assert.equal(timeReport.status, 'DIVERGED');
  assert.equal(timeReport.diffs.some((diff) => diff.kind === 'TRADE_TIME_MISMATCH'), true);
});

test('unknown private statuses and delete messages never create a terminal state from open-orders evidence', () => {
  const unknown = new VenueConvergenceEngine('btcturk');
  unknown.bootstrap(snapshot(1000));
  unknown.observePrivateEvent({ kind: 'ORDER_UPDATE', order: order({ status: 'Mystery', updatedAtMs: 1001 }) });
  const unknownReport = unknown.finalize(snapshot(1002));
  assert.equal(unknownReport.status, 'DIVERGED');
  assert.equal(unknownReport.diffs.some((diff) => diff.kind === 'UNKNOWN_PRIVATE_ORDER_STATUS'), true);

  const deleted = new VenueConvergenceEngine('btcturk');
  deleted.bootstrap(snapshot(1000));
  deleted.observePrivateEvent({ kind: 'ORDER_DELETE', order: order({ status: 'Cancelled', updatedAtMs: 1001 }) });
  const deletedReport = deleted.finalize(snapshot(1002));
  assert.equal(deletedReport.status, 'DIVERGED');
  assert.equal(deletedReport.activeOrderScope, 'REST_OPEN_ORDERS_ACTIVE_ONLY');
  assert.equal(deletedReport.diffs.some((diff) => diff.kind === 'PRIVATE_ORDER_DELETE_REQUIRES_RESYNC'), true);
});

test('a REST active-order omission is divergence, not proof of a terminal order', () => {
  const engine = new VenueConvergenceEngine('btcturk');
  engine.bootstrap(snapshot(1000));
  const report = engine.finalize(snapshot(1002, []));
  assert.equal(report.status, 'DIVERGED');
  assert.equal(report.diffs.some((diff) => diff.kind === 'ACTIVE_ORDER_MISSING_FROM_REST'), true);
});

test('markResyncRequired discards the old epoch and only a fresh REST bootstrap can restart it', () => {
  const engine = new VenueConvergenceEngine('btcturk');
  engine.bootstrap(snapshot(1000));
  engine.markResyncRequired('RECONNECT');
  assert.equal(engine.getPhase(), 'RESYNC_REQUIRED');
  assert.equal(engine.requiresResync(), true);
  assert.throws(() => engine.finalize(snapshot(1002)), /CONVERGENCE_REST_BOOTSTRAP_REQUIRED/);

  engine.bootstrap(snapshot(2000));
  assert.equal(engine.getPhase(), 'REST_ANCHORED');
  assert.equal(engine.finalize(snapshot(2001)).status, 'CONVERGED');
});

test('an invalid REST snapshot is fail-closed and cannot leave an old epoch trusted', () => {
  const engine = new VenueConvergenceEngine('btcturk');
  engine.bootstrap(snapshot(1000));
  const invalid = snapshot(1002, [order({ status: 'Unknown', updatedAtMs: 1001 })]);
  assert.throws(() => engine.finalize(invalid), /CONVERGENCE_UNKNOWN_ORDER_STATUS/);
  assert.equal(engine.getPhase(), 'DIVERGED');
  assert.equal(engine.requiresResync(), true);

  const invalidBootstrap = new VenueConvergenceEngine('btcturk');
  assert.throws(() => invalidBootstrap.bootstrap(invalid), /CONVERGENCE_UNKNOWN_ORDER_STATUS/);
  assert.equal(invalidBootstrap.getPhase(), 'RESYNC_REQUIRED');
});

test('REST capture is read-only and accepts an injected clock for deterministic bootstrap', async () => {
  const adapter: Pick<VenueAdapter, 'getAccountState' | 'getOpenOrders'> = {
    async getAccountState() { return snapshot(1000).account; },
    async getOpenOrders() { return snapshot(1000).openOrders; },
  };
  const captured = await captureRestConvergenceSnapshot(adapter, () => 1000);
  assert.equal(captured.capturedAtMs, 1000);
  assert.equal(captured.openOrders[0]?.orderId, 'O-1');
});
