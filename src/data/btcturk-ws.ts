import type { MarketEvent } from '../venues/types.js';

export type BtcTurkSubscription = {
  channel: 'ticker' | 'trade' | 'orderbook' | 'obdiff';
  event: string;
};

export type BtcTurkWsEnvelope = readonly [type: number, payload: Record<string, unknown>];

export function buildBtcTurkSubscription(input: BtcTurkSubscription): string {
  if (!input.event.trim()) throw new Error('BTCTURK_WS_EVENT_REQUIRED');
  return JSON.stringify([151, { type: 151, channel: input.channel, event: input.event.toUpperCase(), join: true }]);
}

export function parseBtcTurkMarketEvent(raw: string, clock: () => number = () => Date.now()): MarketEvent[] {
  const decoded: unknown = JSON.parse(raw);
  if (!Array.isArray(decoded) || decoded.length !== 2) throw new Error('BTCTURK_WS_ENVELOPE_INVALID');
  const [type, payload] = decoded as [unknown, unknown];
  if (typeof type !== 'number' || !payload || typeof payload !== 'object') throw new Error('BTCTURK_WS_ENVELOPE_INVALID');
  const body = payload as Record<string, unknown>;
  switch (type) {
    case 402: return [tickerEvent(body, clock)];
    case 401: {
      const items = body.items;
      if (!Array.isArray(items)) throw new Error('BTCTURK_WS_TICKER_ALL_INVALID');
      return items.map((item) => tickerEvent(item as Record<string, unknown>, clock));
    }
    case 422: return [tradeEvent(body, clock)];
    case 431: return [orderBookEvent('ORDER_BOOK', body, clock)];
    case 432: return [orderBookEvent('ORDER_BOOK', body, clock)];
    default: return [];
  }
}

function tickerEvent(body: Record<string, unknown>, clock: () => number): MarketEvent {
  const symbol = requiredString(body.PS, 'PS');
  const receivedAtMs = clock();
  const eventTimeMs = body.TS === undefined && body.timestamp === undefined ? receivedAtMs : numberValue(body.TS ?? body.timestamp, 'ticker timestamp');
  return {
    kind: 'TICKER', symbol, eventTimeMs, receivedAtMs,
    payload: { bid: numberValue(body.B, 'B'), ask: numberValue(body.A, 'A'), last: numberValue(body.La, 'La'), bidQuantity: numberValue(body.BA, 'BA'), askQuantity: numberValue(body.AA, 'AA'), raw: body },
  };
}

function tradeEvent(body: Record<string, unknown>, clock: () => number): MarketEvent {
  return {
    kind: 'TRADE',
    symbol: String(body.PS ?? '').toUpperCase(),
    eventTimeMs: numberValue(body.D, 'D'),
    receivedAtMs: clock(),
    payload: { amount: numberValue(body.A, 'A'), side: Number(body.S) === 0 ? 'BUY' : 'SELL', price: numberValue(body.P, 'P'), tradeId: requiredString(body.I, 'I'), raw: body },
  };
}

function orderBookEvent(kind: MarketEvent['kind'], body: Record<string, unknown>, clock: () => number): MarketEvent {
  const symbol = requiredString(body.PS, 'PS');
  const payload = { changeSet: body.CS, changeProcess: body.CP, asks: body.AO ?? [], bids: body.BO ?? [], raw: body };
  const receivedAtMs = clock();
  return { kind, symbol, eventTimeMs: receivedAtMs, receivedAtMs, payload };
}

function requiredString(value: unknown, name: string): string {
  const result = String(value ?? '').trim().toUpperCase();
  if (!result) throw new Error(`BTCTURK_WS_${name}_REQUIRED`);
  return result;
}

function numberValue(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`BTCTURK_WS_${name.toUpperCase().replace(/ /g, '_')}_INVALID`);
  return n;
}
