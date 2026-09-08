import { createHash } from 'node:crypto';
import type {
  AccountState,
  InstrumentMetadata,
  MarketSnapshot,
  MutationOutcome,
  OrderReference,
  VenueAdapter,
  VenueAuth,
  VenueCapabilities,
  VenueOrder,
  VenueOrderIntent,
  VenueTransport,
  UnknownOrderState,
} from './types.js';

const BASE_PATH = '/api';
const profilePayload = {
  venueId: 'btcturk',
  apiVersion: 'v1-private-v2-public',
  marketType: 'SPOT' as const,
  orderTypes: ['LIMIT', 'MARKET', 'STOP_LIMIT', 'STOP_MARKET'],
  postOnlySupport: false,
  reduceOnlySupport: false,
  conditionalOrderSupport: true,
  serverTimeSource: 'VENUE_API' as const,
  clientOrderIdempotency: 'SUPPORTED' as const,
  positionSemantics: 'INVENTORY' as const,
  feeModel: 'VENUE_SCHEDULE' as const,
  minimumOrderConstraints: 'DYNAMIC_METADATA' as const,
  rateLimits: 'VENUE_DOCUMENTED' as const,
  websocketSemantics: 'OUT_OF_SCOPE' as const,
  reconciliationCapabilities: ['ORDER_BY_ID', 'OPEN_ORDERS', 'ALL_ORDERS', 'TRADE_TRANSACTIONS'],
};

function profileHash(): string {
  return createHash('sha256').update(JSON.stringify(profilePayload)).digest('hex');
}

function asNumber(value: unknown, name: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`VENUE_INVALID_NUMBER:${name}`);
  return n;
}

function requireSuccess(body: unknown): { data: unknown } {
  const value = body as { success?: boolean; code?: number; message?: string; data?: unknown };
  if (value?.success !== true || value.code !== 0) throw new Error(`VENUE_API_REJECTED:${value?.message ?? 'UNKNOWN'}`);
  return { data: value.data };
}

export class BtcTurkSpotAdapter implements VenueAdapter {
  constructor(
    private readonly transport: VenueTransport,
    private readonly auth?: VenueAuth,
  ) {}

  async getCapabilities(): Promise<VenueCapabilities> {
    return { ...profilePayload, profileHash: profileHash() };
  }

  async getInstrumentMetadata(symbol: string): Promise<InstrumentMetadata> {
    const response = await this.transport.request<unknown>({ method: 'GET', pathWithQuery: `${BASE_PATH}/v2/server/exchangeinfo` });
    const { data } = requireSuccess(response.body);
    const root = data as { symbols?: readonly Record<string, unknown>[] };
    const item = root.symbols?.find((entry) => String(entry.name ?? '').toUpperCase() === symbol.toUpperCase());
    if (!item) throw new Error(`VENUE_INSTRUMENT_NOT_FOUND:${symbol}`);
    return {
      symbol: String(item.name),
      status: String(item.status),
      baseAsset: String(item.numerator),
      quoteAsset: String(item.denominator),
      priceScale: asNumber(item.numeratorScale, 'numeratorScale'),
      quantityScale: asNumber(item.denominatorScale, 'denominatorScale'),
      minimumExchangeValue: item.minExchangeValue === undefined ? undefined : asNumber(item.minExchangeValue, 'minExchangeValue'),
    };
  }

  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
    const response = await this.transport.request<unknown>({ method: 'GET', pathWithQuery: `${BASE_PATH}/v2/ticker?pairSymbol=${encodeURIComponent(symbol)}` });
    const { data } = requireSuccess(response.body);
    const ticker = Array.isArray(data) ? data[0] : undefined;
    if (!ticker) throw new Error(`VENUE_TICKER_NOT_FOUND:${symbol}`);
    const row = ticker as Record<string, unknown>;
    const now = Date.now();
    return {
      symbol: String(row.pair ?? symbol),
      eventTimeMs: asNumber(row.timestamp, 'timestamp'),
      receivedAtMs: now,
      bid: asNumber(row.bid, 'bid'),
      ask: asNumber(row.ask, 'ask'),
      last: asNumber(row.last, 'last'),
    };
  }

  async getAccountState(): Promise<AccountState> {
    const response = await this.privateRequest<unknown>('GET', `${BASE_PATH}/v1/users/balances`);
    const { data } = requireSuccess(response);
    const balances = (data as readonly Record<string, unknown>[]).map((row) => ({
      asset: String(row.asset),
      total: asNumber(String(row.balance).replace(',', '.'), 'balance'),
      free: asNumber(String(row.free).replace(',', '.'), 'free'),
      locked: asNumber(String(row.locked).replace(',', '.'), 'locked'),
      timestampMs: asNumber(row.timestamp, 'timestamp'),
    }));
    return { venueId: 'btcturk', balances, asOfMs: Date.now() };
  }

  async getOpenOrders(symbol?: string): Promise<readonly VenueOrder[]> {
    const query = symbol ? `?pairSymbol=${encodeURIComponent(symbol)}` : '';
    const response = await this.privateRequest<unknown>('GET', `${BASE_PATH}/v1/openOrders${query}`);
    const { data } = requireSuccess(response);
    return this.normalizeOrders(data);
  }

  async getOrder(ref: OrderReference): Promise<VenueOrder | UnknownOrderState> {
    if (ref.venueId !== 'btcturk') return { kind: 'UNKNOWN_ORDER_STATE', reference: ref, reason: 'VENUE_MISMATCH' };
    try {
      const response = await this.privateRequest<unknown>('GET', `${BASE_PATH}/v1/order/${encodeURIComponent(ref.orderId)}`);
      const { data } = requireSuccess(response);
      return this.normalizeOrders([data])[0];
    } catch (error) {
      return { kind: 'UNKNOWN_ORDER_STATE', reference: ref, reason: error instanceof Error ? error.message : 'UNKNOWN' };
    }
  }

  async submitOrder(_intent: VenueOrderIntent): Promise<MutationOutcome> {
    return { status: 'REJECTED', reason: 'LIVE_MUTATION_REQUIRES_COORDINATOR_BOUNDARY' };
  }

  async cancelOrder(_ref: OrderReference): Promise<MutationOutcome> {
    return { status: 'REJECTED', reason: 'LIVE_MUTATION_REQUIRES_COORDINATOR_BOUNDARY' };
  }

  private async privateRequest<T>(method: string, pathWithQuery: string): Promise<{ status: number; body: T }> {
    if (!this.auth) throw new Error('PRIVATE_AUTH_REQUIRED');
    const headers = await this.auth.authorize({ method, pathWithQuery });
    return this.transport.request<T>({ method, pathWithQuery, headers });
  }

  private normalizeOrders(data: unknown): VenueOrder[] {
    const rows = (Array.isArray(data) ? data : [data]) as readonly Record<string, unknown>[];
    return rows.map((row) => ({
      orderId: String(row.id),
      symbol: String(row.pairsymbol ?? row.pairSymbol),
      side: String(row.type).toUpperCase() as VenueOrder['side'],
      method: normalizeMethod(String(row.method)),
      status: String(row.status),
      quantity: asNumber(row.quantity, 'quantity'),
      price: row.price === undefined ? undefined : asNumber(row.price, 'price'),
      clientOrderId: row.orderClientId === undefined ? undefined : String(row.orderClientId),
      createdAtMs: asNumber(row.time, 'time'),
      updatedAtMs: asNumber(row.updateTime ?? row.time, 'updateTime'),
      filledQuantity: row.leftAmount === undefined ? undefined : Math.max(0, asNumber(row.quantity, 'quantity') - asNumber(row.leftAmount, 'leftAmount')),
      remainingQuantity: row.leftAmount === undefined ? undefined : asNumber(row.leftAmount, 'leftAmount'),
    }));
  }
}

function normalizeMethod(method: string): VenueOrder['method'] {
  const normalized = method.toUpperCase().replace(/[^A-Z]/g, '');
  if (normalized === 'LIMIT') return 'LIMIT';
  if (normalized === 'MARKET') return 'MARKET';
  if (normalized === 'STOPLIMIT') return 'STOP_LIMIT';
  if (normalized === 'STOPMARKET') return 'STOP_MARKET';
  throw new Error(`VENUE_UNKNOWN_ORDER_METHOD:${method}`);
}
