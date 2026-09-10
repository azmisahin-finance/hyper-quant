import { createHash } from 'node:crypto';
import { DeterministicPaperExecutor, type PaperOrder } from '../execution/paper-execution.js';
import type { ManagedOrder } from '../execution/order-management.js';
import type { MarketSnapshot } from '../venues/types.js';

/**
 * M1 product boundary: this component can only create deterministic paper
 * orders. It accepts read-only market observations and has no venue mutation,
 * credential, signer, or live-capital capability.
 */
export const PAPER_BOT_EXECUTION_MODE = 'PAPER_ONLY' as const;
export const PAPER_BOT_LIVE_TRADING_STATUS = 'PROHIBITED' as const;

export type PaperBotSignal =
  | { action: 'HOLD'; rationale: string }
  | { action: 'BUY' | 'SELL'; quantity: number; rationale: string };

export type PaperBotStrategy = {
  strategyId: string;
  decide(snapshot: Readonly<MarketSnapshot>, status: Readonly<PaperBotOperatorStatus>): PaperBotSignal;
};

export type PaperBotRiskLimits = {
  maxPositionQuantity: number;
  maxOrderQuantity: number;
  maxOrderNotional: number;
  minimumVirtualQuoteReserve: number;
};

export type PaperBotConfig = {
  sessionId: string;
  symbol: string;
  initialVirtualQuoteBalance: number;
  feeBps: number;
  riskLimits: PaperBotRiskLimits;
  strategy: PaperBotStrategy;
};

export type PaperPosition = {
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  averageCostPerUnit: number;
  costBasis: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  markPrice?: number;
};

export type PaperBotRiskDecision = {
  allowed: boolean;
  reason: string;
  signalAction: PaperBotSignal['action'];
  requestedQuantity: number;
};

export type PaperBotOperatorStatus = {
  mode: typeof PAPER_BOT_EXECUTION_MODE;
  liveTrading: typeof PAPER_BOT_LIVE_TRADING_STATUS;
  capital: 'SIMULATED_ONLY';
  marketData: 'READ_ONLY_INPUT';
  state: 'ACTIVE';
  sessionId: string;
  symbol: string;
  strategyId: string;
  latestSequence: number;
  virtualQuoteBalance: number;
  position: PaperPosition;
  lastSignal?: PaperBotSignal;
  lastRiskDecision?: PaperBotRiskDecision;
  paperExecutionHash: string;
};

export type PaperBotEventType =
  | 'MARKET_OBSERVED'
  | 'SIGNAL_GENERATED'
  | 'STRATEGY_ERROR'
  | 'RISK_EVALUATED'
  | 'PAPER_ORDER_SUBMITTED'
  | 'PAPER_FILL_APPLIED';

export type PaperBotEvent = {
  sequence: number;
  timestampMs: number;
  type: PaperBotEventType;
  payload: Readonly<Record<string, string | number | boolean>>;
};

export type PaperBotSession = {
  sessionId: string;
  symbol: string;
  mode: typeof PAPER_BOT_EXECUTION_MODE;
  operatorStatus: PaperBotOperatorStatus;
  events: readonly PaperBotEvent[];
  orders: readonly PaperOrder[];
  paperExecutionHash: string;
  sessionHash: string;
};

/** Deliberately narrow source contract; it cannot expose a submit/cancel method. */
export interface ReadOnlyMarketDataSource {
  getMarketSnapshot(symbol: string): Promise<MarketSnapshot>;
}

const EPS = 1e-12;

function isPositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function copyPosition(position: PaperPosition): PaperPosition {
  return { ...position };
}

function copySignal(signal: PaperBotSignal | undefined): PaperBotSignal | undefined {
  return signal ? { ...signal } : undefined;
}

function copyRiskDecision(decision: PaperBotRiskDecision | undefined): PaperBotRiskDecision | undefined {
  return decision ? { ...decision } : undefined;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class DeterministicPaperBot {
  private readonly paper: DeterministicPaperExecutor;
  private readonly events: PaperBotEvent[] = [];
  private readonly appliedFillQuantities = new Map<string, number>();
  private readonly initialVirtualQuoteBalance: number;
  private readonly position: PaperPosition;
  private virtualQuoteBalance: number;
  private latestSequence = 0;
  private orderNumber = 0;
  private lastSignal: PaperBotSignal | undefined;
  private lastRiskDecision: PaperBotRiskDecision | undefined;

  constructor(private readonly config: PaperBotConfig) {
    this.validateConfig(config);
    this.paper = new DeterministicPaperExecutor(config.sessionId);
    this.initialVirtualQuoteBalance = config.initialVirtualQuoteBalance;
    this.virtualQuoteBalance = config.initialVirtualQuoteBalance;
    this.position = {
      symbol: config.symbol,
      quantity: 0,
      averageEntryPrice: 0,
      averageCostPerUnit: 0,
      costBasis: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
    };
  }

  get symbol(): string {
    return this.config.symbol;
  }

  observeMarket(sequence: number, snapshot: MarketSnapshot): PaperBotSession {
    this.validateSnapshot(snapshot);
    this.paper.observe(sequence, snapshot);
    this.latestSequence = sequence;
    this.markPosition(snapshot);
    this.record(sequence, snapshot.receivedAtMs, 'MARKET_OBSERVED', {
      symbol: snapshot.symbol,
      eventTimeMs: snapshot.eventTimeMs,
      receivedAtMs: snapshot.receivedAtMs,
    });

    this.settleWorkingOrders(sequence, snapshot);

    let signal: PaperBotSignal;
    try {
      signal = this.validateSignal(this.config.strategy.decide(Object.freeze({ ...snapshot }), this.operatorStatus()));
    } catch {
      const rejected: PaperBotRiskDecision = { allowed: false, reason: 'STRATEGY_ERROR', signalAction: 'HOLD', requestedQuantity: 0 };
      this.lastSignal = { action: 'HOLD', rationale: 'strategy error' };
      this.lastRiskDecision = rejected;
      this.record(sequence, snapshot.receivedAtMs, 'STRATEGY_ERROR', { strategyId: this.config.strategy.strategyId });
      this.recordRisk(sequence, snapshot.receivedAtMs, rejected);
      return this.result();
    }

    this.lastSignal = signal;
    this.record(sequence, snapshot.receivedAtMs, 'SIGNAL_GENERATED', this.signalPayload(signal));
    const risk = this.evaluateRisk(signal, snapshot);
    this.lastRiskDecision = risk;
    this.recordRisk(sequence, snapshot.receivedAtMs, risk);
    if (!risk.allowed || signal.action === 'HOLD') return this.result();

    const orderId = `${this.config.sessionId}:paper:${String(++this.orderNumber).padStart(6, '0')}`;
    const decision = this.paper.submit({
      orderId,
      clientOrderId: `${this.config.sessionId}:client:${String(this.orderNumber).padStart(6, '0')}`,
      symbol: this.config.symbol,
      side: signal.action,
      method: 'MARKET',
      quantity: signal.quantity,
      createdAtMs: snapshot.receivedAtMs,
    });
    this.record(sequence, snapshot.receivedAtMs, 'PAPER_ORDER_SUBMITTED', {
      orderId,
      side: signal.action,
      quantity: signal.quantity,
      decision: decision.reason,
    });
    this.settleOrder(orderId, sequence, snapshot);
    return this.result();
  }

  operatorStatus(): PaperBotOperatorStatus {
    const paperExecutionHash = this.paper.result().sessionHash;
    return {
      mode: PAPER_BOT_EXECUTION_MODE,
      liveTrading: PAPER_BOT_LIVE_TRADING_STATUS,
      capital: 'SIMULATED_ONLY',
      marketData: 'READ_ONLY_INPUT',
      state: 'ACTIVE',
      sessionId: this.config.sessionId,
      symbol: this.config.symbol,
      strategyId: this.config.strategy.strategyId,
      latestSequence: this.latestSequence,
      virtualQuoteBalance: this.virtualQuoteBalance,
      position: copyPosition(this.position),
      lastSignal: copySignal(this.lastSignal),
      lastRiskDecision: copyRiskDecision(this.lastRiskDecision),
      paperExecutionHash,
    };
  }

  result(): PaperBotSession {
    const paperSession = this.paper.result();
    const events = this.events.map((event) => ({ ...event, payload: { ...event.payload } }));
    const operatorStatus = this.operatorStatus();
    const canonical = {
      sessionId: this.config.sessionId,
      symbol: this.config.symbol,
      mode: PAPER_BOT_EXECUTION_MODE,
      operatorStatus,
      events,
      orders: paperSession.orders,
      paperExecutionHash: paperSession.sessionHash,
    };
    return {
      ...canonical,
      sessionHash: hash(canonical),
    };
  }

  private validateConfig(config: PaperBotConfig): void {
    if (!config.sessionId.trim()) throw new Error('PAPER_BOT_SESSION_ID_REQUIRED');
    if (!config.symbol.trim()) throw new Error('PAPER_BOT_SYMBOL_REQUIRED');
    if (!config.strategy || !config.strategy.strategyId.trim() || typeof config.strategy.decide !== 'function') throw new Error('PAPER_BOT_STRATEGY_REQUIRED');
    if (!Number.isFinite(config.initialVirtualQuoteBalance) || config.initialVirtualQuoteBalance < 0) throw new Error('INVALID_VIRTUAL_QUOTE_BALANCE');
    if (!Number.isFinite(config.feeBps) || config.feeBps < 0 || config.feeBps > 10_000) throw new Error('INVALID_PAPER_FEE_BPS');
    const limits = config.riskLimits;
    if (!limits || !isPositive(limits.maxPositionQuantity) || !isPositive(limits.maxOrderQuantity) || !isPositive(limits.maxOrderNotional)) {
      throw new Error('INVALID_PAPER_RISK_LIMITS');
    }
    if (!Number.isFinite(limits.minimumVirtualQuoteReserve) || limits.minimumVirtualQuoteReserve < 0) throw new Error('INVALID_VIRTUAL_QUOTE_RESERVE');
  }

  private validateSnapshot(snapshot: MarketSnapshot): void {
    if (snapshot.symbol !== this.config.symbol) throw new Error('PAPER_BOT_SYMBOL_MISMATCH');
    if (!Number.isInteger(snapshot.eventTimeMs) || snapshot.eventTimeMs < 0 || !Number.isInteger(snapshot.receivedAtMs) || snapshot.receivedAtMs < 0) {
      throw new Error('INVALID_PAPER_BOT_MARKET_TIME');
    }
    for (const value of [snapshot.bid, snapshot.ask, snapshot.last, snapshot.bidQuantity, snapshot.askQuantity]) {
      if (value !== undefined && !isPositive(value)) throw new Error('INVALID_PAPER_BOT_MARKET_VALUE');
    }
  }

  private validateSignal(signal: PaperBotSignal): PaperBotSignal {
    if (!signal || typeof signal.rationale !== 'string' || !signal.rationale.trim()) throw new Error('INVALID_PAPER_SIGNAL');
    if (signal.action === 'HOLD') return { action: 'HOLD', rationale: signal.rationale };
    if ((signal.action === 'BUY' || signal.action === 'SELL') && isPositive(signal.quantity)) {
      return { action: signal.action, quantity: signal.quantity, rationale: signal.rationale };
    }
    throw new Error('INVALID_PAPER_SIGNAL');
  }

  private evaluateRisk(signal: PaperBotSignal, snapshot: MarketSnapshot): PaperBotRiskDecision {
    if (signal.action === 'HOLD') return { allowed: true, reason: 'NO_ACTION', signalAction: 'HOLD', requestedQuantity: 0 };
    if (this.hasWorkingOrder()) return { allowed: false, reason: 'WORKING_PAPER_ORDER_EXISTS', signalAction: signal.action, requestedQuantity: signal.quantity };
    if (signal.quantity > this.config.riskLimits.maxOrderQuantity + EPS) {
      return { allowed: false, reason: 'MAX_ORDER_QUANTITY', signalAction: signal.action, requestedQuantity: signal.quantity };
    }
    const executionPrice = signal.action === 'BUY' ? snapshot.ask : snapshot.bid;
    if (!isPositive(executionPrice)) return { allowed: false, reason: 'EXECUTABLE_QUOTE_REQUIRED', signalAction: signal.action, requestedQuantity: signal.quantity };
    const notional = signal.quantity * executionPrice;
    if (notional > this.config.riskLimits.maxOrderNotional + EPS) {
      return { allowed: false, reason: 'MAX_ORDER_NOTIONAL', signalAction: signal.action, requestedQuantity: signal.quantity };
    }
    if (signal.action === 'BUY') {
      if (this.position.quantity + signal.quantity > this.config.riskLimits.maxPositionQuantity + EPS) {
        return { allowed: false, reason: 'MAX_POSITION_QUANTITY', signalAction: signal.action, requestedQuantity: signal.quantity };
      }
      const fee = notional * this.config.feeBps / 10_000;
      if (this.virtualQuoteBalance - notional - fee < this.config.riskLimits.minimumVirtualQuoteReserve - EPS) {
        return { allowed: false, reason: 'VIRTUAL_CASH_LIMIT', signalAction: signal.action, requestedQuantity: signal.quantity };
      }
    } else if (signal.quantity > this.position.quantity + EPS) {
      return { allowed: false, reason: 'SELL_EXCEEDS_SIMULATED_INVENTORY', signalAction: signal.action, requestedQuantity: signal.quantity };
    }
    return { allowed: true, reason: 'PAPER_RISK_ACCEPTED', signalAction: signal.action, requestedQuantity: signal.quantity };
  }

  private settleWorkingOrders(sequence: number, snapshot: MarketSnapshot): void {
    const openOrders = this.paper.result().orders.filter((order) =>
      order.symbol === this.config.symbol && (order.status === 'WORKING' || order.status === 'PARTIALLY_FILLED'),
    );
    for (const order of openOrders) this.settleOrder(order.orderId, sequence, snapshot);
  }

  private settleOrder(orderId: string, sequence: number, snapshot: MarketSnapshot): void {
    const order = this.paper.result().orders.find((candidate) => candidate.orderId === orderId);
    if (!order || !this.hasExecutableQuote(order, snapshot)) return;
    const fill = this.paper.evaluate(orderId);
    if (fill) this.applyFill(fill, sequence, snapshot.receivedAtMs);
  }

  private hasExecutableQuote(order: PaperOrder, snapshot: MarketSnapshot): boolean {
    return order.side === 'BUY' ? isPositive(snapshot.ask) : isPositive(snapshot.bid);
  }

  private applyFill(fill: ManagedOrder, sequence: number, timestampMs: number): void {
    const previouslyApplied = this.appliedFillQuantities.get(fill.orderId) ?? 0;
    const cumulativeFill = fill.originalQuantity - fill.remainingQuantity;
    const filledQuantity = cumulativeFill - previouslyApplied;
    if (filledQuantity <= EPS) return;
    if (!isPositive(fill.price)) throw new Error('INVALID_PAPER_FILL_PRICE');
    const gross = filledQuantity * fill.price;
    const fee = gross * this.config.feeBps / 10_000;
    if (fill.side === 'BUY') {
      if (this.virtualQuoteBalance - gross - fee < this.config.riskLimits.minimumVirtualQuoteReserve - EPS) throw new Error('PAPER_FILL_BREACHES_VIRTUAL_CASH_LIMIT');
      const nextQuantity = this.position.quantity + filledQuantity;
      if (nextQuantity > this.config.riskLimits.maxPositionQuantity + EPS) throw new Error('PAPER_FILL_BREACHES_POSITION_LIMIT');
      this.virtualQuoteBalance -= gross + fee;
      this.position.costBasis += gross + fee;
      this.position.quantity = nextQuantity;
      this.position.averageEntryPrice = ((this.position.averageEntryPrice * (nextQuantity - filledQuantity)) + gross) / nextQuantity;
    } else {
      if (filledQuantity > this.position.quantity + EPS) throw new Error('PAPER_FILL_EXCEEDS_SIMULATED_INVENTORY');
      const consumedCostBasis = filledQuantity * this.position.averageCostPerUnit;
      const netProceeds = gross - fee;
      this.virtualQuoteBalance += netProceeds;
      this.position.realizedPnl += netProceeds - consumedCostBasis;
      this.position.costBasis = Math.max(0, this.position.costBasis - consumedCostBasis);
      this.position.quantity = Math.max(0, this.position.quantity - filledQuantity);
      if (this.position.quantity <= EPS) {
        this.position.quantity = 0;
        this.position.costBasis = 0;
        this.position.averageEntryPrice = 0;
      }
    }
    this.position.averageCostPerUnit = this.position.quantity > EPS ? this.position.costBasis / this.position.quantity : 0;
    this.appliedFillQuantities.set(fill.orderId, cumulativeFill);
    this.markPosition({ symbol: this.config.symbol, eventTimeMs: timestampMs, receivedAtMs: timestampMs, last: fill.price });
    this.record(sequence, timestampMs, 'PAPER_FILL_APPLIED', {
      orderId: fill.orderId,
      side: fill.side,
      quantity: filledQuantity,
      price: fill.price,
      fee,
      remainingQuantity: fill.remainingQuantity,
    });
  }

  private markPosition(snapshot: MarketSnapshot): void {
    const markPrice = isPositive(snapshot.last)
      ? snapshot.last
      : isPositive(snapshot.bid) && isPositive(snapshot.ask)
        ? (snapshot.bid + snapshot.ask) / 2
        : snapshot.bid ?? snapshot.ask;
    if (isPositive(markPrice)) this.position.markPrice = markPrice;
    this.position.unrealizedPnl = this.position.quantity > EPS && isPositive(this.position.markPrice)
      ? this.position.quantity * this.position.markPrice - this.position.costBasis
      : 0;
    this.position.totalPnl = this.virtualQuoteBalance + (this.position.quantity * (this.position.markPrice ?? 0)) - this.initialVirtualQuoteBalance;
  }

  private hasWorkingOrder(): boolean {
    return this.paper.result().orders.some((order) => order.status === 'WORKING' || order.status === 'PARTIALLY_FILLED');
  }

  private recordRisk(sequence: number, timestampMs: number, decision: PaperBotRiskDecision): void {
    this.record(sequence, timestampMs, 'RISK_EVALUATED', {
      allowed: decision.allowed,
      reason: decision.reason,
      signalAction: decision.signalAction,
      requestedQuantity: decision.requestedQuantity,
    });
  }

  private signalPayload(signal: PaperBotSignal): Record<string, string | number> {
    return signal.action === 'HOLD'
      ? { action: signal.action, rationale: signal.rationale }
      : { action: signal.action, quantity: signal.quantity, rationale: signal.rationale };
  }

  private record(sequence: number, timestampMs: number, type: PaperBotEventType, payload: Readonly<Record<string, string | number | boolean>>): void {
    this.events.push({ sequence, timestampMs, type, payload: { ...payload } });
  }
}

/**
 * Runs one observation through the M1 product flow. The source is intentionally
 * read-only and the bot remains PAPER_ONLY regardless of the source implementation.
 */
export async function runReadOnlyPaperBotTick(
  source: ReadOnlyMarketDataSource,
  bot: DeterministicPaperBot,
  sequence: number,
): Promise<PaperBotSession> {
  const snapshot = await source.getMarketSnapshot(bot.symbol);
  return bot.observeMarket(sequence, snapshot);
}
