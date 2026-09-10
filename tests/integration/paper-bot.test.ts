import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DeterministicPaperBot,
  PAPER_BOT_EXECUTION_MODE,
  PAPER_BOT_LIVE_TRADING_STATUS,
  runReadOnlyPaperBotTick,
  type PaperBotConfig,
  type ReadOnlyMarketDataSource,
} from '../../src/product/paper-bot.js';
import type { MarketSnapshot } from '../../src/venues/types.js';

function config(strategy: PaperBotConfig['strategy']): PaperBotConfig {
  return {
    sessionId: 'btc-try-m1',
    symbol: 'BTCTRY',
    initialVirtualQuoteBalance: 10_000,
    feeBps: 10,
    riskLimits: {
      maxPositionQuantity: 2,
      maxOrderQuantity: 1,
      maxOrderNotional: 1_000,
      minimumVirtualQuoteReserve: 0,
    },
    strategy,
  };
}

function source(...snapshots: MarketSnapshot[]): ReadOnlyMarketDataSource {
  let index = 0;
  return {
    async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
      assert.equal(symbol, 'BTCTRY');
      const snapshot = snapshots[index++];
      if (!snapshot) throw new Error('FIXTURE_SOURCE_EXHAUSTED');
      return { ...snapshot };
    },
  };
}

test('M1 paper bot runs read-only data through strategy, risk, paper fill, position, PnL, event log, and operator status', async () => {
  const bot = new DeterministicPaperBot(config({
    strategyId: 'buy-then-sell',
    decide: (_snapshot, status) => status.position.quantity === 0
      ? { action: 'BUY', quantity: 1, rationale: 'initial simulated inventory' }
      : { action: 'SELL', quantity: 1, rationale: 'close simulated inventory' },
  }));
  const market = source(
    { symbol: 'BTCTRY', eventTimeMs: 1_000, receivedAtMs: 1_001, bid: 100, ask: 101, last: 100.5, bidQuantity: 2, askQuantity: 2 },
    { symbol: 'BTCTRY', eventTimeMs: 2_000, receivedAtMs: 2_001, bid: 110, ask: 111, last: 110.5, bidQuantity: 2, askQuantity: 2 },
  );

  await runReadOnlyPaperBotTick(market, bot, 1);
  const result = await runReadOnlyPaperBotTick(market, bot, 2);

  assert.equal(result.mode, PAPER_BOT_EXECUTION_MODE);
  assert.equal(result.operatorStatus.liveTrading, PAPER_BOT_LIVE_TRADING_STATUS);
  assert.equal(result.operatorStatus.capital, 'SIMULATED_ONLY');
  assert.equal(result.operatorStatus.marketData, 'READ_ONLY_INPUT');
  assert.equal(result.orders.length, 2);
  assert.ok(result.orders.every((order) => order.status === 'FILLED'));
  assert.equal(result.operatorStatus.position.quantity, 0);
  assert.ok(result.operatorStatus.position.realizedPnl > 0);
  assert.ok(result.operatorStatus.position.totalPnl > 0);
  assert.ok(result.events.some((event) => event.type === 'MARKET_OBSERVED'));
  assert.ok(result.events.some((event) => event.type === 'SIGNAL_GENERATED'));
  assert.ok(result.events.some((event) => event.type === 'RISK_EVALUATED' && event.payload.allowed === true));
  assert.equal(result.events.filter((event) => event.type === 'PAPER_FILL_APPLIED').length, 2);
  assert.equal(result.sessionHash.length, 64);
});

test('M1 paper bot rejects a risk-breaking signal without emitting an order', () => {
  const bot = new DeterministicPaperBot(config({
    strategyId: 'too-large',
    decide: () => ({ action: 'BUY', quantity: 3, rationale: 'must be rejected' }),
  }));
  const result = bot.observeMarket(1, { symbol: 'BTCTRY', eventTimeMs: 1_000, receivedAtMs: 1_001, bid: 100, ask: 101, last: 100.5 });

  assert.equal(result.orders.length, 0);
  assert.equal(result.operatorStatus.lastRiskDecision?.allowed, false);
  assert.equal(result.operatorStatus.lastRiskDecision?.reason, 'MAX_ORDER_QUANTITY');
  assert.equal(result.operatorStatus.position.quantity, 0);
  assert.equal(result.operatorStatus.liveTrading, 'PROHIBITED');
});

test('M1 paper bot session is deterministic for identical read-only observations and strategy output', () => {
  const run = () => {
    const bot = new DeterministicPaperBot(config({
      strategyId: 'one-buy',
      decide: (_snapshot, status) => status.position.quantity === 0
        ? { action: 'BUY', quantity: 1, rationale: 'deterministic fixture' }
        : { action: 'HOLD', rationale: 'already positioned' },
    }));
    bot.observeMarket(1, { symbol: 'BTCTRY', eventTimeMs: 1_000, receivedAtMs: 1_001, bid: 100, ask: 101, last: 100.5, askQuantity: 1 });
    bot.observeMarket(2, { symbol: 'BTCTRY', eventTimeMs: 2_000, receivedAtMs: 2_001, bid: 101, ask: 102, last: 101.5, askQuantity: 1 });
    return bot.result().sessionHash;
  };

  assert.equal(run(), run());
});
