import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImmutableEventLog } from '../../src/data/immutable-event-log.js';
import { MarketDataRecorder } from '../../src/data/market-data-recorder.js';
import { buildBtcTurkSubscription, parseBtcTurkMarketEvent } from '../../src/data/btcturk-ws.js';

 test('recorder persists normalized events and preserves venue source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-recorder-'));
  try {
    const log = new ImmutableEventLog(join(root, 'events.jsonl'));
    const recorder = new MarketDataRecorder(log, { source: 'BTCTURK', clock: () => 999 });
    await recorder.record({ kind: 'TICKER', symbol: 'btctry', eventTimeMs: 100, receivedAtMs: 200, payload: { last: 101 } });
    await recorder.verify();
    const [event] = await log.readAll();
    assert.equal(event.eventType, 'TICKER');
    assert.deepEqual(event.payload, { source: 'BTCTURK', symbol: 'BTCTRY', last: 101 });
    assert.equal(event.receivedAtMs, 999);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('BtcTurk WebSocket subscription and ticker decoding are deterministic', () => {
  assert.equal(buildBtcTurkSubscription({ channel: 'ticker', event: 'btctry' }), '[151,{"type":151,"channel":"ticker","event":"BTCTRY","join":true}]');
  const events = parseBtcTurkMarketEvent('[402,{"type":402,"PS":"BTCTRY","La":"100","B":"99","A":"101","BA":"0.5","AA":"0.7"}]');
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'TICKER');
  assert.equal(events[0].symbol, 'BTCTRY');
  assert.equal((events[0].payload as { last: number }).last, 100);
});

test('BtcTurk all-ticker and orderbook models normalize deterministically with an injected clock', () => {
  const tickerEvents = parseBtcTurkMarketEvent('[401,{"type":401,"items":[{"PS":"BTCTRY","La":"100","B":"99","A":"101","BA":"0.5","AA":"0.7"}]}]', () => 1234);
  assert.equal(tickerEvents[0].eventTimeMs, 1234);
  const bookEvents = parseBtcTurkMarketEvent('[431,{"type":431,"PS":"BTCTRY","CS":7,"AO":[],"BO":[]}]', () => 1234);
  assert.equal(bookEvents[0].eventTimeMs, 1234);
  assert.equal(bookEvents[0].receivedAtMs, 1234);
});

test('BtcTurk trade message maps documented side and millisecond timestamp', () => {
  const events = parseBtcTurkMarketEvent('[422,{"type":422,"PS":"BTCTRY","A":"0.01","S":1,"D":1700000000000,"P":"100.5","I":"t-1"}]');
  assert.deepEqual(events[0].payload, { amount: 0.01, side: 'SELL', price: 100.5, tradeId: 'T-1', raw: { type: 422, PS: 'BTCTRY', A: '0.01', S: 1, D: 1700000000000, P: '100.5', I: 't-1' } });
});


test('immutable event log serializes concurrent append operations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hq-recorder-race-'));
  try {
    const log = new ImmutableEventLog(join(root, 'events.jsonl'));
    await Promise.all(Array.from({ length: 25 }, (_, i) => log.append({ eventType: 'TICKER', eventTimeMs: i + 1, receivedAtMs: i + 1, payload: { i } })));
    await log.verifyChain();
    const events = await log.readAll();
    assert.equal(events.length, 25);
    assert.deepEqual(events.map((event) => event.sequence), Array.from({ length: 25 }, (_, i) => i + 1));
  } finally { await rm(root, { recursive: true, force: true }); }
});
