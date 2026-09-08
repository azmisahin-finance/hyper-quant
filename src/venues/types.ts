export type VenueCapabilities = {
  venueId: string;
  apiVersion: string;
  marketType: 'SPOT' | 'DERIVATIVES';
  orderTypes: readonly string[];
  postOnlySupport: boolean;
  reduceOnlySupport: boolean;
  conditionalOrderSupport: boolean;
  serverTimeSource: 'VENUE_API';
  clientOrderIdempotency: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
  positionSemantics: 'INVENTORY' | 'NET_POSITION' | 'HEDGED_POSITION' | 'UNKNOWN';
  feeModel: 'VENUE_SCHEDULE' | 'UNKNOWN';
  minimumOrderConstraints: 'DYNAMIC_METADATA';
  rateLimits: 'VENUE_DOCUMENTED';
  websocketSemantics: 'OUT_OF_SCOPE' | 'DOCUMENTED';
  reconciliationCapabilities: readonly string[];
  profileHash: string;
};

export type InstrumentMetadata = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  priceScale: number;
  quantityScale: number;
  minimumExchangeValue?: number;
  minimumQuantity?: number;
};

export type MarketSnapshot = {
  symbol: string;
  eventTimeMs: number;
  receivedAtMs: number;
  bid?: number;
  ask?: number;
  last?: number;
  bidQuantity?: number;
  askQuantity?: number;
};

export type MarketEvent = {
  kind: 'TICKER' | 'ORDER_BOOK' | 'TRADE';
  symbol: string;
  eventTimeMs: number;
  receivedAtMs: number;
  payload: unknown;
};

export type AccountBalance = {
  asset: string;
  total: number;
  free: number;
  locked: number;
  timestampMs: number;
};

export type AccountState = {
  venueId: string;
  balances: readonly AccountBalance[];
  asOfMs: number;
};

export type OrderReference = {
  venueId: string;
  orderId: string;
};

export type VenueOrder = {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  method: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';
  status: string;
  quantity: number;
  price?: number;
  clientOrderId?: string;
  createdAtMs: number;
  updatedAtMs: number;
  filledQuantity?: number;
  remainingQuantity?: number;
};

export type UnknownOrderState = { kind: 'UNKNOWN_ORDER_STATE'; reference: OrderReference; reason: string };

export type VenueOrderIntent = {
  symbol: string;
  side: 'BUY' | 'SELL';
  method: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';
  quantity: string;
  price?: string;
  stopPrice?: string;
  clientOrderId: string;
};

export type MutationOutcome =
  | { status: 'ACCEPTED'; remoteId: string }
  | { status: 'REJECTED'; reason: string }
  | { status: 'UNKNOWN_REQUIRES_RECONCILIATION'; reference: OrderReference; reason: string };

export interface VenueAdapter {
  getCapabilities(): Promise<VenueCapabilities>;
  getInstrumentMetadata(symbol: string): Promise<InstrumentMetadata>;
  getMarketSnapshot(symbol: string): Promise<MarketSnapshot>;
  getAccountState(): Promise<AccountState>;
  getOpenOrders(symbol?: string): Promise<readonly VenueOrder[]>;
  getOrder(ref: OrderReference): Promise<VenueOrder | UnknownOrderState>;
  submitOrder(intent: VenueOrderIntent): Promise<MutationOutcome>;
  cancelOrder(ref: OrderReference): Promise<MutationOutcome>;
}

export interface VenueAuth {
  authorize(input: { method: string; pathWithQuery: string }): Promise<Readonly<Record<string, string>>>;
}

export interface VenueTransport {
  request<T>(input: { method: string; pathWithQuery: string; body?: unknown; headers?: Readonly<Record<string, string>> }): Promise<{ status: number; body: T }>;
}

export interface MutationGateway {
  submit(pathWithQuery: string, body: unknown, headers: Readonly<Record<string, string>>): Promise<MutationOutcome>;
  cancel(pathWithQuery: string, headers: Readonly<Record<string, string>>): Promise<MutationOutcome>;
}
