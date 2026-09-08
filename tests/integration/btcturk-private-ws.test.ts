import test from 'node:test';
import assert from 'node:assert/strict';
import { BtcTurkPrivateObservationSession } from '../../src/data/btcturk-private-session.js';
import { buildBtcTurkWsHmacLogin, parseBtcTurkPrivateEvent } from '../../src/data/btcturk-private-ws.js';
import type { BtcTurkSocket } from '../../src/data/btcturk-ws-session.js';

type FakeSocket = BtcTurkSocket & { sent: string[]; closed: boolean };
function socket(): FakeSocket { return { sent: [], closed: false, async send(m) { this.sent.push(m); }, async close() { this.closed = true; } }; }

test('private websocket HMAC login is deterministic and uses the documented 114 envelope', () => {
  const msg = buildBtcTurkWsHmacLogin({ publicKey: 'PUB', privateKeyBase64: 'c2VjcmV0', nonce: 3000, timestampMs: 1700000000000 });
  assert.deepEqual(JSON.parse(msg)[0], 114);
  assert.deepEqual(JSON.parse(msg)[1], { type: 114, publicKey: 'PUB', timestamp: 1700000000000, nonce: 3000, signature: 'F9RVly8uNZL0TB2aDJiqDjYYsVHDwvK0O6AwUQzL57A=' });
});

test('private websocket parser normalizes order insert/update/delete and trade/match events', () => {
  const insert = parseBtcTurkPrivateEvent(JSON.stringify([451, { ID: 9, symbol: 'BTCTRY', isBid: true, method: 0, amount: '1.5', numLeft: 1, price: '100', newOrderClientId: 'c1', timestamp: 1000 }]));
  assert.equal(insert[0]?.kind, 'ORDER_INSERT');
  assert.equal((insert[0] as any).order.remainingQuantity, 1);
  const trade = parseBtcTurkPrivateEvent(JSON.stringify([423, { id: 5, orderId: 9, numeratorSymbol: 'BTC', denominatorSymbol: 'TRY', amount: '0.5', fee: '0.1', tax: '0', price: '100', orderType: 'buy', timestamp: 1001 }]));
  assert.equal(trade[0]?.kind, 'USER_TRADE');
});

test('private session requires authenticated login before trusted private state', async () => {
  const forwarded: string[] = [];
  const s = new BtcTurkPrivateObservationSession('p1', { onEvent: (event) => { forwarded.push(event.kind); } });
  const sock = socket();
  await s.connect(sock, { publicKey: 'PUB', privateKeyBase64: 'c2VjcmV0', nonce: 3000, timestampMs: 1700000000000 });
  assert.equal(s.getPhase(), 'AUTHENTICATING');
  await s.handleMessage(JSON.stringify([114, { type: 114, ok: true, message: 'OK' }]));
  assert.equal(s.getPhase(), 'AUTHENTICATED');
  assert.equal(s.requiresResync(), true);
  s.markResyncComplete();
  assert.equal(s.requiresResync(), false);
  assert.equal(s.snapshot().privateObservationCount, 1);
  assert.deepEqual(forwarded, []);
  await assert.rejects(() => s.handleMessage(JSON.stringify([114, { type: 114, ok: true, message: 'duplicate' }])), /LOGIN_EVENT_OUTSIDE_AUTHENTICATION/);
});

test('private session rejects login failure and stays resync-required', async () => {
  const s = new BtcTurkPrivateObservationSession('p2');
  const sock = socket();
  await s.connect(sock, { publicKey: 'PUB', privateKeyBase64: 'c2VjcmV0', nonce: 3000, timestampMs: 1700000000000 });
  await assert.rejects(() => s.handleMessage(JSON.stringify([114, { type: 114, ok: false, message: 'AUTH_FAILED' }])), /AUTH_FAILED/);
  assert.equal(s.getPhase(), 'RESYNC_REQUIRED');
  assert.equal(s.requiresResync(), true);
});


test('private session rejects order/trade events before authentication', async () => {
  const s = new BtcTurkPrivateObservationSession('p3');
  const sock = socket();
  await s.connect(sock, { publicKey: 'PUB', privateKeyBase64: 'c2VjcmV0', nonce: 3000, timestampMs: 1700000000000 });
  await assert.rejects(
    () => s.handleMessage(JSON.stringify([451, { ID: 9, symbol: 'BTCTRY', isBid: true, method: 0, amount: '1', numLeft: 1, price: '100', timestamp: 1000 }])),
    /BEFORE_AUTHENTICATION/,
  );
  assert.equal(s.getPhase(), 'AUTHENTICATING');
});
