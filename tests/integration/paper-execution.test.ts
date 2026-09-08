import assert from 'node:assert/strict';
import test from 'node:test';
import { DeterministicPaperExecutor } from '../../src/execution/paper-execution.js';

test('paper execution requires ordered market observations and never mutates without market state', () => {
  const paper = new DeterministicPaperExecutor('paper-1');
  assert.throws(() => paper.submit({ orderId: 'o1', clientOrderId: 'c1', symbol: 'BTCTRY', side: 'BUY', method: 'MARKET', quantity: 1, createdAtMs: 1 }), /PAPER_MARKET_STATE_REQUIRED/);
  paper.observe(1, { symbol: 'BTCTRY', eventTimeMs: 1000, receivedAtMs: 1001, bid: 100, ask: 101, last: 100.5, askQuantity: 0.5, bidQuantity: 0.4 });
  assert.throws(() => paper.observe(1, { symbol: 'BTCTRY', eventTimeMs: 1000, receivedAtMs: 1001, bid: 100, ask: 101, last: 100.5 }), /PAPER_SEQUENCE_REPLAY/);
});

test('paper execution makes marketable limit fills at no worse than quote', () => {
  const paper = new DeterministicPaperExecutor('paper-2');
  paper.observe(1, { symbol: 'BTCTRY', eventTimeMs: 1000, receivedAtMs: 1001, bid: 100, ask: 101, last: 100.5, askQuantity: 2 });
  paper.submit({ orderId: 'o2', clientOrderId: 'c2', symbol: 'BTCTRY', side: 'BUY', method: 'LIMIT', quantity: 1.5, price: 102, createdAtMs: 1001 });
  const filled = paper.evaluate('o2');
  assert.equal(filled?.status, 'FILLED');
  assert.equal(filled?.price, 101);
});

test('paper execution caps fills at observed top-of-book liquidity', () => {
  const paper = new DeterministicPaperExecutor('paper-3');
  paper.observe(1, { symbol: 'BTCTRY', eventTimeMs: 1000, receivedAtMs: 1001, bid: 100, ask: 101, last: 100.5, askQuantity: 0.4 });
  paper.submit({ orderId: 'o3', clientOrderId: 'c3', symbol: 'BTCTRY', side: 'BUY', method: 'MARKET', quantity: 1, createdAtMs: 1001 });
  const partial = paper.evaluate('o3');
  assert.equal(partial?.remainingQuantity, 0.6);
  assert.equal(partial?.status, 'ACTIVE');
});

test('paper execution is deterministic and cancel is terminal', () => {
  const run = () => {
    const paper = new DeterministicPaperExecutor('paper-4');
    paper.observe(1, { symbol: 'BTCTRY', eventTimeMs: 1000, receivedAtMs: 1001, bid: 100, ask: 101, last: 100.5 });
    paper.submit({ orderId: 'o4', clientOrderId: 'c4', symbol: 'BTCTRY', side: 'SELL', method: 'LIMIT', quantity: 1, price: 102, createdAtMs: 1001 });
    paper.cancel('o4');
    return paper.result().sessionHash;
  };
  assert.equal(run(), run());
  assert.throws(() => {
    const p = new DeterministicPaperExecutor('paper-5');
    p.observe(1, { symbol: 'BTCTRY', eventTimeMs: 1000, receivedAtMs: 1001, bid: 100, ask: 101, last: 100.5 });
    p.submit({ orderId: 'o5', clientOrderId: 'c5', symbol: 'BTCTRY', side: 'SELL', method: 'MARKET', quantity: 1, createdAtMs: 1001 });
    p.evaluate('o5');
    p.cancel('o5');
  }, /PAPER_CANCEL_AFTER_FILL/);
});


test('paper execution cannot double-fill the same order against the same observation', () => {
  const paper = new DeterministicPaperExecutor('paper-6');
  paper.observe(1, { symbol: 'BTCTRY', eventTimeMs: 1000, receivedAtMs: 1001, bid: 100, ask: 101, last: 100.5, askQuantity: 0.6 });
  paper.submit({ orderId: 'o6', clientOrderId: 'c6', symbol: 'BTCTRY', side: 'BUY', method: 'MARKET', quantity: 1, createdAtMs: 1001 });
  const first = paper.evaluate('o6');
  const second = paper.evaluate('o6');
  assert.equal(first?.remainingQuantity, 0.4);
  assert.equal(second, null);
  assert.equal(paper.result().orders[0].remainingQuantity, 0.4);
  paper.observe(2, { symbol: 'BTCTRY', eventTimeMs: 1001, receivedAtMs: 1002, bid: 100, ask: 101, last: 100.5, askQuantity: 0.2 });
  const next = paper.evaluate('o6');
  assert.equal(next?.remainingQuantity, 0.2);
});
