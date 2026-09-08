import { createHash } from 'node:crypto';
import type { MarketSnapshot } from '../venues/types.js';
import type { ManagedOrder } from './order-management.js';

export type PaperOrder = {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  method: 'LIMIT' | 'MARKET';
  quantity: number;
  remainingQuantity: number;
  price?: number;
  createdAtMs: number;
  status: 'PENDING' | 'WORKING' | 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'CANCELLED';
  lastEvaluatedSequence: number;
};

export type PaperObservation = {
  sequence: number;
  observedAtMs: number;
  snapshot: MarketSnapshot;
};

export type PaperDecision = {
  orderId: string;
  action: 'SUBMIT' | 'CANCEL' | 'NOOP';
  reason: string;
  observedSequence: number;
};

export type PaperSession = {
  sessionId: string;
  orders: readonly PaperOrder[];
  decisions: readonly PaperDecision[];
  observations: readonly PaperObservation[];
  sessionHash: string;
};

const EPS = 1e-12;
const finitePositive = (n: number): boolean => Number.isFinite(n) && n > 0;

export class DeterministicPaperExecutor {
  private readonly orders = new Map<string, PaperOrder>();
  private readonly decisions: PaperDecision[] = [];
  private readonly observations: PaperObservation[] = [];
  private lastSequence = 0;
  private lastObservedAtMs = 0;

  constructor(private readonly sessionId: string) {
    if (!sessionId.trim()) throw new Error('PAPER_SESSION_ID_REQUIRED');
  }

  observe(sequence: number, snapshot: MarketSnapshot): void {
    if (!Number.isInteger(sequence) || sequence < 1) throw new Error('INVALID_PAPER_SEQUENCE');
    if (sequence <= this.lastSequence) throw new Error('PAPER_SEQUENCE_REPLAY');
    if (!Number.isInteger(snapshot.eventTimeMs) || snapshot.eventTimeMs < 0) throw new Error('INVALID_PAPER_EVENT_TIME');
    if (snapshot.receivedAtMs < this.lastObservedAtMs) throw new Error('PAPER_TIME_REWIND');
    this.lastSequence = sequence;
    this.lastObservedAtMs = snapshot.receivedAtMs;
    this.observations.push({ sequence, observedAtMs: snapshot.receivedAtMs, snapshot: { ...snapshot } });
  }

  submit(order: Omit<PaperOrder, 'status' | 'remainingQuantity' | 'lastEvaluatedSequence'>): PaperDecision {
    if (this.orders.has(order.orderId)) throw new Error('PAPER_ORDER_REPLAY');
    if (!order.clientOrderId || !order.symbol || !finitePositive(order.quantity)) throw new Error('INVALID_PAPER_ORDER');
    if (order.method === 'LIMIT' && !finitePositive(order.price ?? NaN)) throw new Error('LIMIT_PRICE_REQUIRED');
    if (order.method === 'MARKET' && order.price !== undefined) throw new Error('MARKET_PRICE_FORBIDDEN');
    const current = this.latestSnapshot(order.symbol);
    if (!current) throw new Error('PAPER_MARKET_STATE_REQUIRED');
    const orderValue: PaperOrder = { ...order, remainingQuantity: order.quantity, status: 'WORKING', lastEvaluatedSequence: 0 };
    this.orders.set(order.orderId, orderValue);
    const decision: PaperDecision = { orderId: order.orderId, action: 'SUBMIT', reason: 'PAPER_ACCEPTED', observedSequence: this.lastSequence };
    this.decisions.push(decision);
    return decision;
  }

  evaluate(orderId: string): ManagedOrder | null {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('PAPER_ORDER_NOT_FOUND');
    const market = this.latestSnapshot(order.symbol);
    if (!market) throw new Error('PAPER_MARKET_STATE_REQUIRED');
    if (order.status === 'FILLED' || order.status === 'CANCELLED') return null;
    if (order.lastEvaluatedSequence === this.lastSequence) return null;
    const executable = Math.min(this.executableQuantity(order, market), order.remainingQuantity);
    if (executable <= EPS) return null;
    const remainingQuantity = Math.max(0, order.remainingQuantity - executable);
    const status = remainingQuantity <= EPS ? 'FILLED' : 'PARTIALLY_FILLED';
    this.orders.set(orderId, { ...order, remainingQuantity, status, lastEvaluatedSequence: this.lastSequence });
    return {
      orderId: order.orderId,
      clientOrderId: order.clientOrderId,
      version: 1,
      symbol: order.symbol,
      side: order.side,
      price: this.executionPrice(order, market),
      originalQuantity: order.quantity,
      remainingQuantity,
      status: status === 'FILLED' ? 'FILLED' : 'ACTIVE',
      updatedAtMs: market.receivedAtMs,
    };
  }

  cancel(orderId: string): PaperDecision {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('PAPER_ORDER_NOT_FOUND');
    if (order.status === 'FILLED') throw new Error('PAPER_CANCEL_AFTER_FILL');
    this.orders.set(orderId, { ...order, status: 'CANCELLED', lastEvaluatedSequence: this.lastSequence });
    const decision: PaperDecision = { orderId, action: 'CANCEL', reason: 'PAPER_CANCELLED', observedSequence: this.lastSequence };
    this.decisions.push(decision);
    return decision;
  }

  result(): PaperSession {
    const orders = [...this.orders.values()].sort((a, b) => a.orderId.localeCompare(b.orderId));
    const canonical = JSON.stringify({ sessionId: this.sessionId, orders, decisions: this.decisions, observations: this.observations });
    return { sessionId: this.sessionId, orders, decisions: [...this.decisions], observations: [...this.observations], sessionHash: createHash('sha256').update(canonical).digest('hex') };
  }

  private latestSnapshot(symbol: string): MarketSnapshot | null {
    for (let i = this.observations.length - 1; i >= 0; i -= 1) {
      if (this.observations[i].snapshot.symbol === symbol) return this.observations[i].snapshot;
    }
    return null;
  }

  private executableQuantity(order: PaperOrder, market: MarketSnapshot): number {
    if (order.method === 'MARKET') return order.side === 'BUY' ? (market.askQuantity ?? order.quantity) : (market.bidQuantity ?? order.quantity);
    if (order.side === 'BUY') {
      if (market.ask === undefined || (order.price ?? 0) + EPS < market.ask) return 0;
      return market.askQuantity ?? order.quantity;
    }
    if (market.bid === undefined || (order.price ?? Infinity) - EPS > market.bid) return 0;
    return market.bidQuantity ?? order.quantity;
  }

  private executionPrice(order: PaperOrder, market: MarketSnapshot): number {
    if (order.side === 'BUY') return order.method === 'MARKET' ? (market.ask ?? NaN) : Math.min(order.price ?? NaN, market.ask ?? NaN);
    return order.method === 'MARKET' ? (market.bid ?? NaN) : Math.max(order.price ?? NaN, market.bid ?? NaN);
  }
}
