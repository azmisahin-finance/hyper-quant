import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImmutableEventLog } from '../../src/data/immutable-event-log.js';
import { OrderLifecycleJournal } from '../../src/execution/order-lifecycle-journal.js';
import { resetLifecycleTestIdentity } from '../../src/execution/order-lifecycle.js';

test.beforeEach(() => resetLifecycleTestIdentity());

test('order lifecycle journal persists and rehydrates the canonical state from an immutable chain', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-order-journal-'));
  try {
    const journal = new OrderLifecycleJournal(new ImmutableEventLog(join(root, 'events.ndjson')));
    await journal.append({ seq: 1, timestampMs: 1_000, type: 'ORDER_CREATED', orderId: 'OJ1', symbol: 'BTC/TRY', side: 'BUY', quantity: 5 });
    await journal.append({ seq: 2, timestampMs: 1_001, type: 'ORDER_ACCEPTED', orderId: 'OJ1' });
    await journal.append({ seq: 3, timestampMs: 1_002, type: 'ORDER_FILL', orderId: 'OJ1', fillId: 'F1', quantity: 2 });
    const state = await journal.load('OJ1');
    assert.equal(state?.status, 'PARTIALLY_FILLED');
    assert.equal(state?.filledQuantity, 2);
    await journal.verify();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('order lifecycle journal rejects histories that do not start with ORDER_CREATED', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-order-journal-'));
  try {
    const journal = new OrderLifecycleJournal(new ImmutableEventLog(join(root, 'events.ndjson')));
    await journal.append({ seq: 2, timestampMs: 1_001, type: 'ORDER_ACCEPTED', orderId: 'OJ2' });
    await assert.rejects(() => journal.load('OJ2'), /ORDER_LIFECYCLE_MISSING_CREATE/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('order lifecycle journal can be reloaded repeatedly in one process without replay false positives', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-order-journal-'));
  try {
    const journal = new OrderLifecycleJournal(new ImmutableEventLog(join(root, 'events.ndjson')));
    await journal.append({ seq: 1, timestampMs: 1_000, type: 'ORDER_CREATED', orderId: 'OJ3', symbol: 'BTC/TRY', side: 'SELL', quantity: 2 });
    await journal.append({ seq: 2, timestampMs: 1_001, type: 'ORDER_ACCEPTED', orderId: 'OJ3' });
    const first = await journal.load('OJ3');
    const second = await journal.load('OJ3');
    assert.deepEqual(second, first);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
