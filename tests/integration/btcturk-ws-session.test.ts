import test from 'node:test';
import assert from 'node:assert/strict';
import { BtcTurkObservationSession, type BtcTurkSocket, type SessionPhase } from '../../src/data/btcturk-ws-session.js';
import type { BtcTurkSubscription } from '../../src/data/btcturk-ws.js';

type FakeSocket = BtcTurkSocket & { sent: string[]; closed: boolean };
function socket(): FakeSocket {
  return {
    sent: [],
    closed: false,
    async send(message) { this.sent.push(message); },
    async close() { this.closed = true; },
  };
}

const sub = (channel: BtcTurkSubscription['channel'], event: string): BtcTurkSubscription => ({ channel, event });

test('ws session replays subscriptions after reconnect and requires resync', async () => {
  const phases: SessionPhase[] = [];
  const resyncs: string[] = [];
  const s = new BtcTurkObservationSession('s1', {
    onPhaseChange: (p) => { phases.push(p); },
    onResyncRequired: (r) => { resyncs.push(r); },
  });
  await s.subscribe(sub('ticker', 'BTCTRY'));
  const a = socket();
  await s.connect(a);
  assert.equal(a.sent.length, 1);
  assert.equal(s.requiresResync(), true);
  s.markResyncComplete();
  assert.equal(s.requiresResync(), false);
  await s.disconnect();
  assert.equal(s.requiresResync(), true);
  const b = socket();
  await s.connect(b);
  assert.equal(b.sent.length, 1);
  assert.deepEqual(resyncs, ['RECONNECT', 'RECONNECT', 'RECONNECT']);
  assert.deepEqual(phases, ['CONNECTING', 'CONNECTED', 'RESYNC_REQUIRED', 'CONNECTING', 'CONNECTED']);
});

test('ws session detects orderbook change-set gap and fails open to resync requirement', async () => {
  const resyncs: string[] = [];
  const s = new BtcTurkObservationSession('s2', { onResyncRequired: (r) => { resyncs.push(r); } });
  const a = socket();
  await s.connect(a);
  s.markResyncComplete();
  await s.handleMessage(JSON.stringify([431, { PS: 'BTCTRY', CS: 10, AO: [], BO: [] }]));
  await s.handleMessage(JSON.stringify([432, { PS: 'BTCTRY', CS: 11, AO: [], BO: [] }]));
  assert.equal(s.requiresResync(), false);
  await s.handleMessage(JSON.stringify([432, { PS: 'BTCTRY', CS: 13, AO: [], BO: [] }]));
  assert.equal(s.requiresResync(), true);
  assert.equal(resyncs.at(-1), 'ORDERBOOK_CHANGESET_GAP');
});

test('ws session rejects messages while disconnected and snapshot is deterministic', async () => {
  const s = new BtcTurkObservationSession('s3');
  await assert.rejects(() => s.handleMessage('[]'), /BTCTURK_SESSION_NOT_CONNECTED/);
  const a = socket();
  await s.connect(a);
  const h1 = s.snapshot().snapshotHash;
  const h2 = s.snapshot().snapshotHash;
  assert.equal(h1, h2);
  await s.close();
  assert.equal(s.getPhase(), 'DISCONNECTED');
  assert.equal(a.closed, true);
});
