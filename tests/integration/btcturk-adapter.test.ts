import assert from 'node:assert/strict';
import test from 'node:test';
import { BtcTurkSpotAdapter } from '../../src/venues/btcturk-spot-adapter.js';
import type { VenueTransport } from '../../src/venues/types.js';

class FakeTransport implements VenueTransport {
  constructor(private readonly responses: Record<string, unknown>) {}
  async request<T>(input: { method: string; pathWithQuery: string }): Promise<{ status: number; body: T }> {
    const body = this.responses[`${input.method} ${input.pathWithQuery}`];
    if (body === undefined) throw new Error(`NO_FIXTURE:${input.method} ${input.pathWithQuery}`);
    return { status: 200, body: body as T };
  }
}

const ok = (data: unknown) => ({ success: true, message: null, code: 0, data });

test('BtcTurk adapter uses documented public paths and normalizes metadata', async () => {
  const adapter = new BtcTurkSpotAdapter(new FakeTransport({
    'GET /api/v2/server/exchangeinfo': ok({ symbols: [{ name: 'BTCTRY', status: 'TRADING', numerator: 'BTC', denominator: 'TRY', numeratorScale: 2, denominatorScale: 8, minExchangeValue: 10 }] }),
    'GET /api/v2/ticker?pairSymbol=BTCTRY': ok([{ pair: 'BTCTRY', timestamp: 1000, bid: 100, ask: 101, last: 100.5 }]),
  }));
  const capabilities = await adapter.getCapabilities();
  assert.equal(capabilities.venueId, 'btcturk');
  const metadata = await adapter.getInstrumentMetadata('BTCTRY');
  assert.equal(metadata.quoteAsset, 'TRY');
  assert.equal(metadata.minimumExchangeValue, 10);
  const market = await adapter.getMarketSnapshot('BTCTRY');
  assert.equal(market.bid, 100);
  assert.equal(market.ask, 101);
});

test('BtcTurk mutation path is fail-closed without an externally supplied mutation gateway', async () => {
  const adapter = new BtcTurkSpotAdapter(new FakeTransport({}));
  const result = await adapter.submitOrder({ symbol: 'BTCTRY', side: 'BUY', method: 'LIMIT', quantity: '0.001', price: '100', clientOrderId: 'hq-test' });
  assert.deepEqual(result, { status: 'REJECTED', reason: 'LIVE_MUTATION_REQUIRES_COORDINATOR_BOUNDARY' });
});
