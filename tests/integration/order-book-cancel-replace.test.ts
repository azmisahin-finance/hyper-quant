import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicOrderBook } from '../../src/execution/order-book.js';
import { DeterministicOrderManager } from '../../src/execution/order-management.js';
import { QueueAwareRestingOrderModel } from '../../src/execution/resting-order-book.js';

test('order book rejects replay, time rewind, and crossed snapshots', () => {
  const book = new DeterministicOrderBook();
  book.applySnapshot({ sequence: 1, timestampMs: 1000, bids: [{ price: 100, quantity: 5 }], asks: [{ price: 101, quantity: 7 }] });
  assert.throws(() => book.applySnapshot({ sequence: 1, timestampMs: 1001, bids: [{ price: 100, quantity: 5 }], asks: [{ price: 101, quantity: 7 }] }), /BOOK_SEQUENCE_REPLAY/);
  assert.throws(() => book.applySnapshot({ sequence: 2, timestampMs: 999, bids: [{ price: 100, quantity: 5 }], asks: [{ price: 101, quantity: 7 }] }), /BOOK_TIME_REWIND/);
  assert.throws(() => book.applySnapshot({ sequence: 3, timestampMs: 1002, bids: [{ price: 102, quantity: 5 }], asks: [{ price: 101, quantity: 7 }] }), /CROSSED_BOOK/);
});

test('order book queue estimate is deterministic and cancellations reduce visible queue', () => {
  const book = new DeterministicOrderBook();
  book.applySnapshot({ sequence: 1, timestampMs: 1000, bids: [{ price: 100, quantity: 5 }], asks: [{ price: 101, quantity: 7 }] });
  assert.deepEqual(book.estimateQueue('BUY', 100, 2), { side: 'BUY', price: 100, queueAhead: 5, queueAfter: 7, sequence: 1 });
  book.applyCancellation({ sequence: 2, timestampMs: 1001, side: 'BID', price: 100, quantity: 2 });
  assert.equal(book.estimateQueue('BUY', 100, 2).queueAhead, 3);
});

test('cancel replace is idempotent, versioned, and preserves remaining quantity bound', () => {
  const manager = new DeterministicOrderManager();
  manager.create({ orderId: 'O1', clientOrderId: 'C1', symbol: 'BTC/TRY', side: 'BUY', price: 100, originalQuantity: 5, updatedAtMs: 1000 });
  manager.applyFill('O1', 2, 1001);
  const pending = manager.startCancelReplace({ orderId: 'O1', newPrice: 99, requestId: 'R1', timestampMs: 1002 });
  assert.equal(pending.status, 'CANCEL_PENDING');
  assert.equal(manager.get('O1')?.status, 'CANCEL_REQUESTED');
  const replaced = manager.completeCancelReplace('O1', { orderId: 'O1', newPrice: 99, requestId: 'R1', timestampMs: 1002 }, 1003);
  assert.equal(replaced.status, 'REPLACED');
  assert.equal(replaced.status === 'REPLACED' ? replaced.newOrder.remainingQuantity : undefined, 3);
  assert.equal(replaced.status === 'REPLACED' ? replaced.newOrder.parentOrderId : undefined, 'O1');
  assert.equal(manager.get('O1')?.status, 'REPLACED');
  const replay = manager.startCancelReplace({ orderId: 'O1', newPrice: 98, requestId: 'R1', timestampMs: 1004 });
  assert.deepEqual(replay, { status: 'REJECTED', oldOrderId: 'O1', requestId: 'R1', reason: 'REPLACE_REQUEST_REPLAY' });
});

test('cancel/fill race is conservative: late fill may complete before cancel confirmation', () => {
  const manager = new DeterministicOrderManager();
  manager.create({ orderId: 'O2', clientOrderId: 'C2', symbol: 'BTC/TRY', side: 'BUY', price: 100, originalQuantity: 5, updatedAtMs: 1000 });
  manager.requestCancel('O2', 1001);
  const filled = manager.applyFill('O2', 5, 1002);
  assert.equal(filled.status, 'FILLED');
  assert.throws(() => manager.confirmCancel('O2', 1003), /CANCEL_CONFIRM_NOT_ALLOWED/);
});

test('cancel replace rejects enlargement beyond remaining quantity and duplicate mutation', () => {
  const manager = new DeterministicOrderManager();
  manager.create({ orderId: 'O3', clientOrderId: 'C3', symbol: 'BTC/TRY', side: 'SELL', price: 110, originalQuantity: 5, updatedAtMs: 1000 });
  manager.applyFill('O3', 4, 1001);
  assert.deepEqual(manager.startCancelReplace({ orderId: 'O3', newPrice: 111, newQuantity: 2, requestId: 'R3', timestampMs: 1002 }), { status: 'REJECTED', oldOrderId: 'O3', requestId: 'R3', reason: 'INVALID_REPLACEMENT_QUANTITY' });
  const ok = manager.startCancelReplace({ orderId: 'O3', newPrice: 111, newQuantity: 1, requestId: 'R4', timestampMs: 1003 });
  assert.equal(ok.status, 'CANCEL_PENDING');
  const done = manager.completeCancelReplace('O3', { orderId: 'O3', newPrice: 111, newQuantity: 1, requestId: 'R4', timestampMs: 1003 }, 1004);
  assert.equal(done.status, 'REPLACED');
});


test('cancel replace is not falsely atomic: late fill changes replacement quantity before cancel confirmation', () => {
  const manager = new DeterministicOrderManager();
  manager.create({ orderId: 'O4', clientOrderId: 'C4', symbol: 'BTC/TRY', side: 'BUY', price: 100, originalQuantity: 5, updatedAtMs: 1000 });
  const pending = manager.startCancelReplace({ orderId: 'O4', newPrice: 99, requestId: 'R4', timestampMs: 1001 });
  assert.equal(pending.status, 'CANCEL_PENDING');
  manager.applyFill('O4', 2, 1002);
  const replaced = manager.completeCancelReplace('O4', { orderId: 'O4', newPrice: 99, requestId: 'R4', timestampMs: 1001 }, 1003);
  assert.equal(replaced.status, 'REPLACED');
  assert.equal(replaced.status === 'REPLACED' ? replaced.newOrder.originalQuantity : undefined, 3);
});

test('queue-aware resting order waits through visible queue and only fills after queue is consumed', () => {
  const book = new DeterministicOrderBook();
  book.applySnapshot({ sequence: 1, timestampMs: 1000, bids: [{ price: 100, quantity: 5 }], asks: [{ price: 101, quantity: 7 }] });
  const queue = new QueueAwareRestingOrderModel();
  queue.place({ orderId: 'R1', side: 'BUY', price: 100, quantity: 2 }, book);
  assert.equal(queue.consumeTrade({ side: 'BID', price: 100, quantity: 5, sequence: 2 }).length, 0);
  const fills = queue.consumeTrade({ side: 'BID', price: 100, quantity: 2, sequence: 3 });
  assert.deepEqual(fills, [{ orderId: 'R1', quantity: 2, price: 100, sequence: 3 }]);
});
