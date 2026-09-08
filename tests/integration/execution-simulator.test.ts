import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicExecutionSimulator, type SimulationBar } from '../../src/execution/simulator.js';

const bar: SimulationBar = {
  timestampMs: 1_000,
  open: 100,
  high: 105,
  low: 99,
  close: 104,
  volume: 100,
  bid: 99.9,
  ask: 100.1,
  bidSize: 10,
  askSize: 10,
};

const model = { feeBps: 10, slippageBps: 5, maxParticipationRate: 0.1, marketImpactBpsPerParticipation: 20 };

test('execution simulator fills deterministically with fees and slippage', () => {
  const a = new DeterministicExecutionSimulator(10_000, model);
  const fillA = a.execute({ orderId: 'B1', timestampMs: 1_000, side: 'BUY', type: 'MARKET', quantity: 5 }, bar);
  assert.equal(fillA.status, 'FILLED');
  const r1 = a.result(1_000, 104);
  const b = new DeterministicExecutionSimulator(10_000, model);
  const fillB = b.execute({ orderId: 'B1', timestampMs: 1_000, side: 'BUY', type: 'MARKET', quantity: 5 }, bar);
  assert.equal(fillB.status, 'FILLED');
  const r2 = b.result(1_000, 104);
  assert.deepEqual(r1, r2);
  assert.equal(r1.fills.length, 1);
  assert.ok(r1.fills[0].price > 100.1);
});

test('execution simulator rejects non-marketable limit without mutating account', () => {
  const sim = new DeterministicExecutionSimulator(10_000, model);
  const result = sim.execute({ orderId: 'L1', timestampMs: 1_000, side: 'BUY', type: 'LIMIT', quantity: 1, limitPrice: 100 }, bar);
  assert.equal(result.status, 'REJECTED');
  const r = sim.result(1_000, 104);
  assert.equal(r.fills.length, 0);
  assert.equal(r.rejections[0].reason, 'LIMIT_NOT_MARKETABLE');
  assert.equal(r.cash, 10_000);
  assert.equal(r.position, 0);
});

test('execution simulator never exceeds top-of-book liquidity when provided', () => {
  const sim = new DeterministicExecutionSimulator(10_000, model);
  const result = sim.execute({ orderId: 'LQ1', timestampMs: 1_000, side: 'BUY', type: 'MARKET', quantity: 20 }, bar);
  assert.equal(result.status, 'PARTIALLY_FILLED');
  assert.equal(result.remainingQuantity, 10);
  const r = sim.result(1_000, 104);
  assert.equal(r.fills.length, 1);
  assert.equal(r.fills[0].quantity, 10);
});

test('execution simulator prevents short sales and overspending', () => {
  const shortSim = new DeterministicExecutionSimulator(10_000, model);
  shortSim.execute({ orderId: 'S1', timestampMs: 1_000, side: 'SELL', type: 'MARKET', quantity: 1 }, bar);
  assert.equal(shortSim.result(1_000, 100).rejections[0].reason, 'INSUFFICIENT_POSITION');

  const cashSim = new DeterministicExecutionSimulator(100, model);
  cashSim.execute({ orderId: 'B2', timestampMs: 1_000, side: 'BUY', type: 'MARKET', quantity: 10 }, bar);
  assert.equal(cashSim.result(1_000, 100).rejections[0].reason, 'INSUFFICIENT_CASH');
});

test('execution simulator realizes pnl on round trip and preserves accounting identity', () => {
  const sim = new DeterministicExecutionSimulator(10_000, model);
  assert.equal(sim.execute({ orderId: 'B3', timestampMs: 1_000, side: 'BUY', type: 'MARKET', quantity: 5 }, bar).status, 'FILLED');
  const sellBar = { ...bar, timestampMs: 2_000, bid: 109.9, ask: 110.1, bidSize: 10, askSize: 10 };
  assert.equal(sim.execute({ orderId: 'S3', timestampMs: 2_000, side: 'SELL', type: 'MARKET', quantity: 5 }, sellBar).status, 'FILLED');
  const r = sim.result(2_000, 110);
  assert.equal(r.position, 0);
  assert.equal(r.unrealizedPnl, 0);
  assert.equal(r.equity, r.cash);
  assert.ok(r.realizedPnl > 0);
});


test('execution simulator fills a marketable limit no worse than the available quote', () => {
  const sim = new DeterministicExecutionSimulator(10_000, model);
  const result = sim.execute({ orderId: 'LM1', timestampMs: 1_000, side: 'BUY', type: 'LIMIT', quantity: 1, limitPrice: 101 }, bar);
  assert.equal(result.status, 'FILLED');
  assert.equal(result.fill?.price, 100.1);
});

test('execution simulator rejects duplicate filled order ids', () => {
  const sim = new DeterministicExecutionSimulator(10_000, model);
  sim.execute({ orderId: 'D1', timestampMs: 1_000, side: 'BUY', type: 'MARKET', quantity: 1 }, bar);
  const second = sim.execute({ orderId: 'D1', timestampMs: 1_000, side: 'BUY', type: 'MARKET', quantity: 1 }, bar);
  assert.equal(second.status, 'REJECTED');
  assert.equal(sim.result(1_000, 104).fills.length, 1);
});
