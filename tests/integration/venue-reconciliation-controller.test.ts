import test from 'node:test';
import assert from 'node:assert/strict';
import { VenueObservationTracker, VenueReconciliationController, reconcileAccount } from '../../src/execution/venue-reconciliation-controller.js';
import { createLifecycleState, applyOrderEvent } from '../../src/execution/order-lifecycle.js';
import type { AccountState, VenueAdapter } from '../../src/venues/types.js';

test('venue observation tracker requires resync after reconnect and sequence gap', () => {
  const tracker = new VenueObservationTracker();
  tracker.start('c1');
  assert.equal(tracker.requiresResync(), true);
  assert.deepEqual(tracker.consumeGap()?.reason, 'RECONNECT');
  tracker.accept(1);
  tracker.accept(2);
  tracker.accept(4);
  assert.equal(tracker.requiresResync(), true);
  const gap = tracker.consumeGap();
  assert.equal(gap?.expectedSequence, 3);
  assert.equal(gap?.receivedSequence, 4);
  assert.throws(() => tracker.accept(4), /VENUE_SEQUENCE_REPLAY/);
});

test('account reconciliation fails on stale snapshot and reports asset divergence', () => {
  const local: AccountState = { venueId: 'btcturk', asOfMs: 100, balances: [{ asset: 'TRY', total: 1000, free: 900, locked: 100, timestampMs: 100 }, { asset: 'BTC', total: 1, free: 1, locked: 0, timestampMs: 100 }] };
  const stale = { ...local, asOfMs: 99 };
  assert.throws(() => reconcileAccount({ local, remote: stale }), /ACCOUNT_SNAPSHOT_STALE/);
  const remote: AccountState = { venueId: 'btcturk', asOfMs: 101, balances: [{ asset: 'TRY', total: 1001, free: 901, locked: 100, timestampMs: 101 }] };
  const diffs = reconcileAccount({ local, remote });
  assert.equal(diffs.length, 2);
  assert.equal(diffs.some((d) => d.kind === 'ACCOUNT_TOTAL_MISMATCH'), true);
  assert.equal(diffs.some((d) => d.kind === 'ACCOUNT_ASSET_MISMATCH'), true);
});

test('venue reconciliation remains read-only and treats unknown remote order as non-terminal', async () => {
  const adapter: VenueAdapter = {
    async getCapabilities() { throw new Error('UNUSED'); },
    async getInstrumentMetadata() { throw new Error('UNUSED'); },
    async getMarketSnapshot() { throw new Error('UNUSED'); },
    async getAccountState() { return { venueId: 'btcturk', balances: [], asOfMs: 10 }; },
    async getOpenOrders() { return []; },
    async getOrder() { return { kind: 'UNKNOWN_ORDER_STATE', reference: { venueId: 'btcturk', orderId: 'O1' }, reason: 'TIMEOUT' }; },
    async submitOrder() { return { status: 'REJECTED', reason: 'MUTATION_BLOCKED' }; },
    async cancelOrder() { return { status: 'REJECTED', reason: 'MUTATION_BLOCKED' }; },
  };
  const local = createLifecycleState({ seq: 1, timestampMs: 1, type: 'ORDER_CREATED', orderId: 'O1', symbol: 'BTC/TRY', side: 'BUY', quantity: 1 });
  const accepted = applyOrderEvent(local, { seq: 2, timestampMs: 2, type: 'ORDER_ACCEPTED', orderId: 'O1' });
  const report = await new VenueReconciliationController(adapter).reconcileOrders([accepted], 10);
  assert.equal(report.diffs[0].kind, 'ORDER_MISSING');
  assert.equal(report.orderDecisions[0].decision.status, 'UNKNOWN_REQUIRES_RECONCILIATION');
});



test('venue order normalization requires exact remaining quantity evidence', async () => {
  const adapter: VenueAdapter = {
    async getCapabilities() { throw new Error('UNUSED'); },
    async getInstrumentMetadata() { throw new Error('UNUSED'); },
    async getMarketSnapshot() { throw new Error('UNUSED'); },
    async getAccountState() { return { venueId: 'btcturk', balances: [], asOfMs: 20 }; },
    async getOpenOrders() { return []; },
    async getOrder() {
      return { orderId: 'O2', symbol: 'BTCUSDT', side: 'BUY', method: 'LIMIT', status: 'Partial', quantity: 5, createdAtMs: 1, updatedAtMs: 20 };
    },
    async submitOrder() { return { status: 'REJECTED', reason: 'MUTATION_BLOCKED' }; },
    async cancelOrder() { return { status: 'REJECTED', reason: 'MUTATION_BLOCKED' }; },
  };
  const local = createLifecycleState({ seq: 1, timestampMs: 1, type: 'ORDER_CREATED', orderId: 'O2', symbol: 'BTC/USDT', side: 'BUY', quantity: 5 });
  const accepted = applyOrderEvent(local, { seq: 2, timestampMs: 2, type: 'ORDER_ACCEPTED', orderId: 'O2' });
  await assert.rejects(() => new VenueReconciliationController(adapter).reconcileOrders([accepted]), /VENUE_FILLED_QUANTITY_UNVERIFIED/);
});

test('account reconciliation rejects remote free-plus-locked identity failure', () => {
  const local: AccountState = { venueId: 'btcturk', asOfMs: 100, balances: [{ asset: 'TRY', total: 1000, free: 900, locked: 100, timestampMs: 100 }] };
  const remote: AccountState = { venueId: 'btcturk', asOfMs: 101, balances: [{ asset: 'TRY', total: 1000, free: 800, locked: 100, timestampMs: 101 }] };
  const diffs = reconcileAccount({ local, remote });
  assert.equal(diffs.some((d) => String(d.remote).includes('IDENTITY_FAILED')), true);
});
