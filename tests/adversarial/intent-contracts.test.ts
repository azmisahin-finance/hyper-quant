import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertIntentTransition, isTransitionAllowed, type IntentState } from '../../src/execution/intent-state-machine.js';
import { FileIntentJournal, type IntentRecord } from '../../src/execution/intent-journal.js';
import { ReconciliationService, type ExchangeReconciler } from '../../src/execution/reconciliation.js';

test('GAP-01: canonical intent state machine rejects forbidden recovery transitions', () => {
  assert.equal(isTransitionAllowed('UNKNOWN_REQUIRES_RECONCILIATION', 'SUBMITTED'), false);
  assert.equal(isTransitionAllowed('UNKNOWN_REQUIRES_RECONCILIATION', 'INTENT_CREATED'), false);
  assert.throws(() => assertIntentTransition('UNKNOWN_REQUIRES_RECONCILIATION', 'SUBMITTED'));
  assert.equal(isTransitionAllowed('SUBMITTED', 'UNKNOWN_REQUIRES_RECONCILIATION'), true);
});

test('GAP-02: durable journal binds intent and transition in one append record', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-journal-'));
  const file = join(root, 'intent.ndjson');
  const journal = new FileIntentJournal(file);
  try {
    const intent: IntentRecord = {
      intentId: 'intent-1',
      idempotencyKey: 'idem-1',
      venueId: 'V1',
      strategyId: 'S1',
      instrumentId: 'BTC/TRY',
      state: 'RISK_AUTHORIZED',
      createdAt: new Date(1_000).toISOString(),
      updatedAt: new Date(2_000).toISOString(),
    };
    await journal.append({ kind: 'INTENT_STATE', intent, previousState: 'DURABLE' });
    const recovered = await journal.get('intent-1');
    assert.deepEqual(recovered, intent);
    assert.equal((await journal.listNonTerminalForInstrument('BTC/TRY')).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('GAP-07: reconciliation uses bounded attempts before failure', async () => {
  let calls = 0;
  const reconciler: ExchangeReconciler = {
    async find() {
      calls += 1;
      return { status: 'UNAVAILABLE' as const };
    },
  };
  const fakeStore = { append: async () => undefined, get: async () => null, listNonTerminal: async () => [], listNonTerminalForInstrument: async () => [] };
  const service = new ReconciliationService(fakeStore, reconciler, { maxAttempts: 3, backoffMs: [0, 0] });
  let state: IntentState = 'UNKNOWN_REQUIRES_RECONCILIATION';
  const intent: IntentRecord = {
    intentId: 'intent-2', idempotencyKey: 'idem-2', venueId: 'V1', strategyId: 'S1', instrumentId: 'BTC/TRY',
    state, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const result = await service.reconcile(intent, async (current, expected, next) => {
    assert.equal(current.state, expected);
    state = next;
    return { ...current, state: next, updatedAt: new Date().toISOString() };
  });
  assert.deepEqual(result, { status: 'RECONCILIATION_FAILED', attempts: 3, escalation: 'ESCALATION_RAISED' });
  assert.equal(calls, 3);
  assert.equal(state, 'RECONCILIATION_FAILED');
});
