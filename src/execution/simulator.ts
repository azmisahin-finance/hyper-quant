import { createHash } from 'node:crypto';

export type SimulationSide = 'BUY' | 'SELL';
export type SimulationOrderType = 'MARKET' | 'LIMIT';

export type SimulationBar = {
  timestampMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
};

export type SimulationOrder = {
  orderId: string;
  timestampMs: number;
  side: SimulationSide;
  type: SimulationOrderType;
  quantity: number;
  limitPrice?: number;
};

export type FillModel = {
  feeBps: number;
  slippageBps: number;
  maxParticipationRate: number;
  marketImpactBpsPerParticipation: number;
};

export type SimulationFill = {
  orderId: string;
  timestampMs: number;
  side: SimulationSide;
  quantity: number;
  price: number;
  notional: number;
  fee: number;
};

export type SimulationOrderResult = {
  orderId: string;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED';
  filledQuantity: number;
  remainingQuantity: number;
  fill?: SimulationFill;
  rejection?: SimulationRejection;
};

export type SimulationRejection = {
  orderId: string;
  timestampMs: number;
  reason:
    | 'INVALID_ORDER'
    | 'INSUFFICIENT_LIQUIDITY'
    | 'LIMIT_NOT_MARKETABLE'
    | 'INSUFFICIENT_CASH'
    | 'INSUFFICIENT_POSITION';
};

export type SimulationResult = {
  fills: readonly SimulationFill[];
  rejections: readonly SimulationRejection[];
  cash: number;
  position: number;
  averageEntryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  equity: number;
  resultHash: string;
};

export type PortfolioSnapshot = {
  timestampMs: number;
  cash: number;
  position: number;
  averageEntryPrice: number;
  marketPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  equity: number;
};

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validateFillModel(model: FillModel): void {
  if (!Number.isFinite(model.feeBps) || model.feeBps < 0) throw new Error('INVALID_FEE_BPS');
  if (!Number.isFinite(model.slippageBps) || model.slippageBps < 0) throw new Error('INVALID_SLIPPAGE_BPS');
  if (!Number.isFinite(model.maxParticipationRate) || model.maxParticipationRate <= 0 || model.maxParticipationRate > 1) throw new Error('INVALID_PARTICIPATION_RATE');
  if (!Number.isFinite(model.marketImpactBpsPerParticipation) || model.marketImpactBpsPerParticipation < 0) throw new Error('INVALID_MARKET_IMPACT');
}

function assertBar(bar: SimulationBar): void {
  if (!Number.isInteger(bar.timestampMs) || bar.timestampMs < 0) throw new Error('INVALID_BAR_TIMESTAMP');
  for (const [name, value] of Object.entries(bar)) {
    if (name !== 'timestampMs' && value !== undefined && typeof value === 'number' && !Number.isFinite(value)) throw new Error('INVALID_MARKET_BAR');
  }
  if (!finitePositive(bar.open) || !finitePositive(bar.high) || !finitePositive(bar.low) || !finitePositive(bar.close) || !finitePositive(bar.volume)) throw new Error('INVALID_MARKET_BAR');
  if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close) || bar.low > bar.high) throw new Error('INVALID_MARKET_BAR_RANGE');
}

function referencePrice(bar: SimulationBar, side: SimulationSide): number {
  const top = side === 'BUY' ? bar.ask : bar.bid;
  return top && top > 0 ? top : bar.open;
}

function applySlippage(price: number, side: SimulationSide, model: FillModel, participation: number): number {
  const direction = side === 'BUY' ? 1 : -1;
  const impactBps = model.slippageBps + model.marketImpactBpsPerParticipation * participation;
  return price * (1 + direction * impactBps / 10_000);
}

export class DeterministicExecutionSimulator {
  private cash: number;
  private position = 0;
  private averageEntryPrice = 0;
  private realizedPnl = 0;
  private fills: SimulationFill[] = [];
  private rejections: SimulationRejection[] = [];
  private orderIds = new Set<string>();

  constructor(initialCash: number, private readonly model: FillModel) {
    if (!finitePositive(initialCash)) throw new Error('INVALID_INITIAL_CASH');
    validateFillModel(model);
    this.cash = initialCash;
  }

  execute(order: SimulationOrder, bar: SimulationBar): SimulationOrderResult {
    assertBar(bar);
    if (this.orderIds.has(order.orderId)) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'INVALID_ORDER' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }
    if (!order.orderId || !Number.isInteger(order.timestampMs) || order.timestampMs < 0 || !finitePositive(order.quantity)) {
      const rejection = { orderId: order.orderId ?? '', timestampMs: bar.timestampMs, reason: 'INVALID_ORDER' as const };
      this.rejections.push(rejection);
      return { orderId: rejection.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }
    if (order.timestampMs > bar.timestampMs) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'INVALID_ORDER' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }
    if (order.type === 'LIMIT' && !finitePositive(order.limitPrice ?? NaN)) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'INVALID_ORDER' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }

    const top = referencePrice(bar, order.side);
    const marketable = order.type === 'MARKET' || (order.side === 'BUY' ? (order.limitPrice as number) >= top : (order.limitPrice as number) <= top);
    if (!marketable) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'LIMIT_NOT_MARKETABLE' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }

    const availableLiquidity = order.side === 'BUY' ? bar.askSize : bar.bidSize;
    const maxByParticipation = bar.volume * this.model.maxParticipationRate;
    const fillable = Math.min(order.quantity, Number.isFinite(availableLiquidity ?? NaN) && (availableLiquidity ?? 0) > 0 ? availableLiquidity as number : maxByParticipation);
    if (!finitePositive(fillable)) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'INSUFFICIENT_LIQUIDITY' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }
    if (fillable + 1e-12 < order.quantity && !(availableLiquidity && availableLiquidity > 0)) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'INSUFFICIENT_LIQUIDITY' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'PARTIALLY_FILLED', filledQuantity: fillable, remainingQuantity: order.quantity - fillable };
    }

    const participation = Math.min(1, fillable / bar.volume);
    const price = order.type === 'LIMIT'
      ? (order.side === 'BUY' ? Math.min(order.limitPrice as number, top) : Math.max(order.limitPrice as number, top))
      : applySlippage(top, order.side, this.model, participation);
    const notional = fillable * price;
    const fee = notional * this.model.feeBps / 10_000;

    if (order.side === 'BUY' && this.cash < notional + fee - 1e-12) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'INSUFFICIENT_CASH' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }
    if (order.side === 'SELL' && this.position < fillable - 1e-12) {
      const rejection = { orderId: order.orderId, timestampMs: bar.timestampMs, reason: 'INSUFFICIENT_POSITION' as const };
      this.rejections.push(rejection);
      return { orderId: order.orderId, status: 'REJECTED', filledQuantity: 0, remainingQuantity: order.quantity, rejection };
    }

    if (order.side === 'BUY') {
      const newPosition = this.position + fillable;
      this.averageEntryPrice = newPosition === 0 ? 0 : ((this.position * this.averageEntryPrice) + notional) / newPosition;
      this.position = newPosition;
      this.cash -= notional + fee;
    } else {
      this.cash += notional - fee;
      this.realizedPnl += (price - this.averageEntryPrice) * fillable - fee;
      this.position -= fillable;
      if (this.position === 0) this.averageEntryPrice = 0;
    }

    const fill = { orderId: order.orderId, timestampMs: bar.timestampMs, side: order.side, quantity: fillable, price, notional, fee };
    this.fills.push(fill);
    this.orderIds.add(order.orderId);
    return {
      orderId: order.orderId,
      status: fillable + 1e-12 >= order.quantity ? 'FILLED' : 'PARTIALLY_FILLED',
      filledQuantity: fillable,
      remainingQuantity: Math.max(0, order.quantity - fillable),
      fill,
    };
  }

  snapshot(timestampMs: number, marketPrice: number): PortfolioSnapshot {
    if (!Number.isFinite(marketPrice) || marketPrice <= 0) throw new Error('INVALID_MARKET_PRICE');
    const unrealizedPnl = this.position * (marketPrice - this.averageEntryPrice);
    const equity = this.cash + this.position * marketPrice;
    return { timestampMs, cash: this.cash, position: this.position, averageEntryPrice: this.averageEntryPrice, marketPrice, realizedPnl: this.realizedPnl, unrealizedPnl, equity };
  }

  result(timestampMs: number, marketPrice: number): SimulationResult {
    const snap = this.snapshot(timestampMs, marketPrice);
    const base = { fills: this.fills, rejections: this.rejections, cash: this.cash, position: this.position, averageEntryPrice: this.averageEntryPrice, realizedPnl: this.realizedPnl, unrealizedPnl: snap.unrealizedPnl, equity: snap.equity };
    return { ...base, resultHash: createHash('sha256').update(JSON.stringify(base)).digest('hex') };
  }
}
