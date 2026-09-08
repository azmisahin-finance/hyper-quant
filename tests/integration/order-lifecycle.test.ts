import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOrderEvent, createLifecycleState, lifecycleDigest, resetLifecycleTestIdentity } from '../../src/execution/order-lifecycle.js';
import { reconcileOrder } from '../../src/execution/order-reconciliation.js';

test.beforeEach(() => resetLifecycleTestIdentity());

test('order lifecycle accepts monotonic fills and closes exactly at quantity', () => {
  const base = createLifecycleState({ seq: 1, timestampMs: 1_000, type: 'ORDER_CREATED', orderId: 'O1', clientOrderId: 'C1', symbol: 'BTC/TRY', side: 'BUY', quantity: 5 });
  const accepted = applyOrderEvent(base, { seq: 2, timestampMs: 1_001, type: 'ORDER_ACCEPTED', orderId: 'O1' });
  const partial = applyOrderEvent(accepted, { seq: 3, timestampMs: 1_002, type: 'ORDER_FILL', orderId: 'O1', fillId: 'F1', quantity: 2 });
  assert.equal(partial.status, 'PARTIALLY_FILLED');
  assert.equal(partial.remainingQuantity, 3);
  const cancelling = applyOrderEvent(partial, { seq: 4, timestampMs: 1_003, type: 'CANCEL_REQUESTED', orderId: 'O1' });
  const lateFill = applyOrderEvent(cancelling, { seq: 5, timestampMs: 1_004, type: 'ORDER_FILL', orderId: 'O1', fillId: 'F2', quantity: 3 });
  assert.equal(lateFill.status, 'FILLED');
  assert.equal(lateFill.remainingQuantity, 0);
  assert.throws(() => applyOrderEvent(lateFill, { seq: 6, timestampMs: 1_005, type: 'ORDER_CANCELLED', orderId: 'O1' }), /TERMINAL_ORDER_MUTATION_FORBIDDEN/);
  resetLifecycleTestIdentity();
  const base2 = createLifecycleState({ seq: 1, timestampMs: 2_000, type: 'ORDER_CREATED', orderId: 'O1B', symbol: 'BTC/TRY', side: 'BUY', quantity: 5 });
  const accepted2 = applyOrderEvent(base2, { seq: 2, timestampMs: 2_001, type: 'ORDER_ACCEPTED', orderId: 'O1B' });
  const partial2 = applyOrderEvent(accepted2, { seq: 3, timestampMs: 2_002, type: 'ORDER_FILL', orderId: 'O1B', fillId: 'F1', quantity: 2 });
  const filled = applyOrderEvent(partial2, { seq: 4, timestampMs: 2_003, type: 'ORDER_FILL', orderId: 'O1B', fillId: 'F2', quantity: 3 });
  assert.equal(filled.status, 'FILLED');
  assert.equal(filled.remainingQuantity, 0);
  assert.ok(lifecycleDigest(filled).length > 0);
});

test('order lifecycle rejects out-of-order and fill replay without mutation', () => {
  const base = createLifecycleState({ seq: 1, timestampMs: 1_000, type: 'ORDER_CREATED', orderId: 'O2', symbol: 'BTC/TRY', side: 'BUY', quantity: 5 });
  const accepted = applyOrderEvent(base, { seq: 2, timestampMs: 1_001, type: 'ORDER_ACCEPTED', orderId: 'O2' });
  const partial = applyOrderEvent(accepted, { seq: 3, timestampMs: 1_002, type: 'ORDER_FILL', orderId: 'O2', fillId: 'F1', quantity: 2 });
  assert.throws(() => applyOrderEvent(partial, { seq: 3, timestampMs: 1_003, type: 'ORDER_FILL', orderId: 'O2', fillId: 'F2', quantity: 1 }), /OUT_OF_ORDER_OR_REPLAYED_EVENT/);
  assert.throws(() => applyOrderEvent(partial, { seq: 4, timestampMs: 1_001, type: 'ORDER_FILL', orderId: 'O2', fillId: 'F2', quantity: 1 }), /NON_MONOTONIC_EVENT_TIME/);
  assert.throws(() => applyOrderEvent(partial, { seq: 5, timestampMs: 1_005, type: 'ORDER_FILL', orderId: 'O2', fillId: 'F1', quantity: 1 }), /FILL_REPLAY/);
  assert.throws(() => applyOrderEvent(partial, { seq: 6, timestampMs: 1_006, type: 'ORDER_FILL', orderId: 'O2', fillId: 'F3', quantity: 4 }), /FILL_EXCEEDS_REMAINING/);
});

test('terminal lifecycle cannot be mutated or cancelled retroactively', () => {
  const base = createLifecycleState({ seq: 1, timestampMs: 1_000, type: 'ORDER_CREATED', orderId: 'O3', symbol: 'BTC/TRY', side: 'BUY', quantity: 1 });
  const rejected = applyOrderEvent(base, { seq: 2, timestampMs: 1_001, type: 'ORDER_REJECTED', orderId: 'O3', reason: 'TEST' });
  assert.equal(rejected.status, 'REJECTED');
  assert.throws(() => applyOrderEvent(rejected, { seq: 3, timestampMs: 1_002, type: 'ORDER_ACCEPTED', orderId: 'O3' }), /TERMINAL_ORDER_MUTATION_FORBIDDEN/);
});

test('unknown remote state stays reconciliation-only until remote identity is trustworthy', () => {
  const local = createLifecycleState({ seq: 1, timestampMs: 1_000, type: 'ORDER_CREATED', orderId: 'O4', symbol: 'BTC/TRY', side: 'BUY', quantity: 5 });
  const unknown = applyOrderEvent(applyOrderEvent(local, { seq: 2, timestampMs: 1_001, type: 'ORDER_ACCEPTED', orderId: 'O4' }), { seq: 3, timestampMs: 1_002, type: 'ORDER_UNKNOWN', orderId: 'O4', reason: 'TIMEOUT' });
  assert.equal(unknown.status, 'UNKNOWN');
  assert.equal(reconcileOrder(unknown, null).status, 'UNKNOWN_REQUIRES_RECONCILIATION');
  assert.equal(reconcileOrder(unknown, { orderId: 'O4', status: 'ACCEPTED', filledQuantity: 0, remainingQuantity: 5, updatedAtMs: 1_003 }).status, 'APPLY_REMOTE_STATE');
});

test('reconciliation rejects stale or inconsistent remote snapshots', () => {
  const local = createLifecycleState({ seq: 1, timestampMs: 2_000, type: 'ORDER_CREATED', orderId: 'O5', symbol: 'BTC/TRY', side: 'BUY', quantity: 5 });
  assert.equal(reconcileOrder(local, { orderId: 'O5', status: 'FILLED', filledQuantity: 5, remainingQuantity: 0, updatedAtMs: 1_999 }).status, 'UNKNOWN_REQUIRES_RECONCILIATION');
  const bad = reconcileOrder(local, { orderId: 'O5', status: 'FILLED', filledQuantity: 4, remainingQuantity: 4, updatedAtMs: 2_001 });
  assert.equal(bad.status, 'UNKNOWN_REQUIRES_RECONCILIATION');
});

import { applyReconciliation } from '../../src/execution/order-reconciliation.js';

test('reconciliation applies only a fresh, quantity-consistent remote snapshot', () => {
  const local = createLifecycleState({ seq: 1, timestampMs: 1_000, type: 'ORDER_CREATED', orderId: 'O6', symbol: 'BTC/TRY', side: 'BUY', quantity: 5 });
  const accepted = applyOrderEvent(local, { seq: 2, timestampMs: 1_001, type: 'ORDER_ACCEPTED', orderId: 'O6' });
  const unknown = applyOrderEvent(accepted, { seq: 3, timestampMs: 1_002, type: 'ORDER_UNKNOWN', orderId: 'O6', reason: 'TIMEOUT' });
  const remote = { orderId: 'O6', status: 'PARTIALLY_FILLED' as const, filledQuantity: 2, remainingQuantity: 3, updatedAtMs: 1_003, fillIds: ['RF1'] };
  const decision = reconcileOrder(unknown, remote);
  assert.equal(decision.status, 'APPLY_REMOTE_STATE');
  const recovered = applyReconciliation(unknown, remote);
  assert.equal(recovered.status, 'PARTIALLY_FILLED');
  assert.equal(recovered.filledQuantity, 2);
  assert.equal(recovered.remainingQuantity, 3);
  assert.throws(() => applyReconciliation(recovered, { ...remote, updatedAtMs: 1_002 }), /REMOTE_SNAPSHOT_STALE/);
});
