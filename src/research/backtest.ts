import { createHash } from 'node:crypto';
import type { FeatureRow, ResearchBar } from './features.js';
import type { ExecutionCostModel } from './cost-model.js';
import { calculateExecutionCost } from './cost-model.js';

export type BaselineSignal = -1 | 0 | 1;

export type BaselineStrategy = {
  signal: (row: FeatureRow) => BaselineSignal;
};

export type BacktestConfig = {
  initialCapital: number;
  latencyBars: number;
  costs: ExecutionCostModel;
};

export type BacktestTrade = {
  signalIndex: number;
  executionIndex: number;
  signalTimeMs: number;
  executionTimeMs: number;
  previousPosition: BaselineSignal;
  nextPosition: BaselineSignal;
  executionPrice: number;
  cost: number;
};

export type BacktestResult = {
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  maxDrawdown: number;
  tradeCount: number;
  meanTradeReturn: number;
  tradeStdDev: number;
  equityCurve: number[];
  trades: BacktestTrade[];
  resultHash: string;
};

function assertConfig(config: BacktestConfig): void {
  if (!Number.isFinite(config.initialCapital) || config.initialCapital <= 0) throw new Error('INVALID_INITIAL_CAPITAL');
  if (!Number.isInteger(config.latencyBars) || config.latencyBars < 0) throw new Error('INVALID_LATENCY_BARS');
}

export function runDeterministicBacktest(
  bars: readonly ResearchBar[],
  features: readonly FeatureRow[],
  strategy: BaselineStrategy,
  config: BacktestConfig,
): BacktestResult {
  assertConfig(config);
  if (bars.length !== features.length) throw new Error('BAR_FEATURE_LENGTH_MISMATCH');
  if (bars.length < 3) throw new Error('INSUFFICIENT_BACKTEST_BARS');

  let equity = config.initialCapital;
  let position: BaselineSignal = 0;
  const equityCurve = [equity];
  const trades: BacktestTrade[] = [];
  const tradeReturns: number[] = [];
  const scheduled = new Map<number, { signalIndex: number; signal: BaselineSignal }>();

  for (let signalIndex = 0; signalIndex < features.length; signalIndex += 1) {
    const row = features[signalIndex];
    const rawSignal = strategy.signal(row);
    if (![-1, 0, 1].includes(rawSignal)) throw new Error('INVALID_BASELINE_SIGNAL');
    const executionIndex = signalIndex + 1 + config.latencyBars;
    if (executionIndex < bars.length) scheduled.set(executionIndex, { signalIndex, signal: rawSignal });
  }

  for (let index = 1; index < bars.length; index += 1) {
    const scheduledAction = scheduled.get(index);
    if (scheduledAction && scheduledAction.signal !== position) {
      const nextPosition: BaselineSignal = scheduledAction.signal;
      const notional = equity;
      const turnover = Math.abs(nextPosition - position);
      const cost = calculateExecutionCost(notional, turnover, config.costs);
      equity -= cost;
      trades.push({
        signalIndex: scheduledAction.signalIndex,
        executionIndex: index,
        signalTimeMs: bars[scheduledAction.signalIndex].timestampMs,
        executionTimeMs: bars[index].timestampMs,
        previousPosition: position,
        nextPosition,
        executionPrice: bars[index].open,
        cost,
      });
      position = nextPosition;
    }

    const barReturn = bars[index].close / bars[index].open - 1;
    const intervalReturn = position * barReturn;
    const before = equity;
    equity *= 1 + intervalReturn;
    const markReturn = before === 0 ? 0 : (equity - before) / before;
    if (position !== 0) tradeReturns.push(markReturn);
    equityCurve.push(equity);
  }

  let peak = equityCurve[0];
  let maxDrawdown = 0;
  for (const value of equityCurve) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
  }

  const meanTradeReturn = tradeReturns.length ? tradeReturns.reduce((sum, value) => sum + value, 0) / tradeReturns.length : 0;
  const variance = tradeReturns.length ? tradeReturns.reduce((sum, value) => sum + (value - meanTradeReturn) ** 2, 0) / tradeReturns.length : 0;
  const tradeStdDev = Math.sqrt(variance);
  const totalReturn = equity / config.initialCapital - 1;
  const normalized = { initialCapital: config.initialCapital, finalCapital: equity, totalReturn, maxDrawdown, tradeCount: trades.length, meanTradeReturn, tradeStdDev, equityCurve, trades };
  const resultHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');

  return { ...normalized, resultHash };
}

export function createZScoreMeanReversionStrategy(featureId: string, entryZ: number, exitZ: number): BaselineStrategy {
  if (!Number.isFinite(entryZ) || entryZ <= 0) throw new Error('INVALID_ENTRY_Z');
  if (!Number.isFinite(exitZ) || exitZ < 0 || exitZ >= entryZ) throw new Error('INVALID_EXIT_Z');
  return {
    signal: (row) => {
      const z = row.values[featureId];
      if (!Number.isFinite(z)) return 0;
      if (z <= -entryZ) return 1;
      if (z >= entryZ) return -1;
      if (Math.abs(z) <= exitZ) return 0;
      return 0;
    },
  };
}
