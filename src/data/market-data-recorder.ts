import type { MarketEvent } from '../venues/types.js';
import { ImmutableEventLog } from './immutable-event-log.js';

export type RecordedMarketEvent = MarketEvent & { source: 'BTCTURK' | 'OTHER' };

export type MarketDataRecorderOptions = {
  source: RecordedMarketEvent['source'];
  clock?: () => number;
};

export class MarketDataRecorder {
  private readonly clock: () => number;

  constructor(private readonly log: ImmutableEventLog, private readonly options: MarketDataRecorderOptions) {
    this.clock = options.clock ?? (() => Date.now());
  }

  async record(event: MarketEvent): Promise<void> {
    const normalized = normalizeMarketEvent(event, this.clock());
    await this.log.append({
      eventType: normalized.kind,
      eventTimeMs: normalized.eventTimeMs,
      receivedAtMs: normalized.receivedAtMs,
      payload: { ...normalized.payloadRecord, source: this.options.source },
    });
  }

  async verify(): Promise<void> {
    await this.log.verifyChain();
  }
}

function normalizeMarketEvent(event: MarketEvent, receivedAtMs: number): {
  kind: MarketEvent['kind'];
  symbol: string;
  eventTimeMs: number;
  receivedAtMs: number;
  payloadRecord: Record<string, unknown>;
} {
  if (!['TICKER', 'ORDER_BOOK', 'TRADE'].includes(event.kind)) throw new Error('MARKET_EVENT_KIND_INVALID');
  const symbol = event.symbol.trim().toUpperCase();
  if (!symbol) throw new Error('MARKET_EVENT_SYMBOL_REQUIRED');
  const eventTimeMs = finiteInteger(event.eventTimeMs, 'eventTimeMs');
  const payloadRecord = event.payload !== null && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? event.payload as Record<string, unknown>
    : { value: event.payload };
  return { kind: event.kind, symbol, eventTimeMs, receivedAtMs: finiteInteger(receivedAtMs, 'receivedAtMs'), payloadRecord: { ...payloadRecord, symbol } };
}

function finiteInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) throw new Error(`MARKET_EVENT_${name.toUpperCase()}_INVALID`);
  return value;
}
