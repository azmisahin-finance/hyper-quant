export type BookSide = 'BID' | 'ASK';
export type BookLevel = { price: number; quantity: number };
export type BookSnapshot = { sequence: number; timestampMs: number; bids: readonly BookLevel[]; asks: readonly BookLevel[] };
export type BookTrade = { sequence: number; timestampMs: number; price: number; quantity: number; aggressor: 'BUY' | 'SELL' };
export type BookCancellation = { sequence: number; timestampMs: number; side: BookSide; price: number; quantity: number };
export type QueueEstimate = { side: 'BUY' | 'SELL'; price: number; queueAhead: number; queueAfter: number; sequence: number };

const EPS = 1e-12;
function finitePositive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function assertSeq(sequence: number): void { if (!Number.isInteger(sequence) || sequence < 1) throw new Error('INVALID_BOOK_SEQUENCE'); }
function assertTime(timestampMs: number): void { if (!Number.isInteger(timestampMs) || timestampMs < 0) throw new Error('INVALID_BOOK_TIMESTAMP'); }
function normalizeLevels(levels: readonly BookLevel[], side: BookSide): BookLevel[] {
  const out: BookLevel[] = [];
  for (const level of levels) {
    if (!finitePositive(level.price) || !finitePositive(level.quantity)) throw new Error('INVALID_BOOK_LEVEL');
    out.push({ price: level.price, quantity: level.quantity });
  }
  out.sort((a, b) => side === 'BID' ? b.price - a.price : a.price - b.price);
  for (let i = 1; i < out.length; i += 1) if (out[i - 1].price === out[i].price) throw new Error('DUPLICATE_BOOK_PRICE');
  return out;
}

export class DeterministicOrderBook {
  private bids: BookLevel[] = [];
  private asks: BookLevel[] = [];
  private lastSequence = 0;
  private lastTimestampMs = 0;

  applySnapshot(snapshot: BookSnapshot): void {
    assertSeq(snapshot.sequence); assertTime(snapshot.timestampMs);
    if (snapshot.sequence <= this.lastSequence) throw new Error('BOOK_SEQUENCE_REPLAY');
    if (snapshot.timestampMs < this.lastTimestampMs) throw new Error('BOOK_TIME_REWIND');
    const bids = normalizeLevels(snapshot.bids, 'BID');
    const asks = normalizeLevels(snapshot.asks, 'ASK');
    if (bids.length > 0 && asks.length > 0 && bids[0].price >= asks[0].price) throw new Error('CROSSED_BOOK');
    this.bids = bids; this.asks = asks; this.lastSequence = snapshot.sequence; this.lastTimestampMs = snapshot.timestampMs;
  }

  applyCancellation(event: BookCancellation): void {
    this.assertNextEvent(event.sequence, event.timestampMs);
    const levels = event.side === 'BID' ? this.bids : this.asks;
    const idx = levels.findIndex((l) => l.price === event.price);
    if (idx < 0) throw new Error('BOOK_CANCEL_UNKNOWN_LEVEL');
    if (!finitePositive(event.quantity) || event.quantity > levels[idx].quantity + EPS) throw new Error('BOOK_CANCEL_EXCEEDS_LEVEL');
    const nextQty = levels[idx].quantity - event.quantity;
    if (nextQty <= EPS) levels.splice(idx, 1); else levels[idx] = { ...levels[idx], quantity: nextQty };
  }

  applyTrade(event: BookTrade): void {
    this.assertNextEvent(event.sequence, event.timestampMs);
    if (!finitePositive(event.price) || !finitePositive(event.quantity)) throw new Error('INVALID_BOOK_TRADE');
    const consumedSide = event.aggressor === 'BUY' ? this.asks : this.bids;
    let remaining = event.quantity;
    while (remaining > EPS && consumedSide.length > 0) {
      const level = consumedSide[0];
      const crosses = event.aggressor === 'BUY' ? event.price >= level.price : event.price <= level.price;
      if (!crosses) break;
      const consumed = Math.min(level.quantity, remaining);
      remaining -= consumed;
      if (level.quantity - consumed <= EPS) consumedSide.shift(); else consumedSide[0] = { ...level, quantity: level.quantity - consumed };
    }
    if (remaining > EPS) throw new Error('BOOK_TRADE_EXCEEDS_VISIBLE_CROSS');
  }

  estimateQueue(side: 'BUY' | 'SELL', price: number, ownQuantity: number): QueueEstimate {
    if (!finitePositive(price) || !finitePositive(ownQuantity)) throw new Error('INVALID_QUEUE_REQUEST');
    const levels = side === 'BUY' ? this.bids : this.asks;
    const level = levels.find((l) => l.price === price);
    if (!level) return { side, price, queueAhead: 0, queueAfter: ownQuantity, sequence: this.lastSequence };
    return { side, price, queueAhead: level.quantity, queueAfter: level.quantity + ownQuantity, sequence: this.lastSequence };
  }

  top(): { bid?: BookLevel; ask?: BookLevel; sequence: number; timestampMs: number } {
    return { bid: this.bids[0], ask: this.asks[0], sequence: this.lastSequence, timestampMs: this.lastTimestampMs };
  }

  snapshot(): BookSnapshot { return { sequence: this.lastSequence, timestampMs: this.lastTimestampMs, bids: [...this.bids], asks: [...this.asks] }; }

  private assertNextEvent(sequence: number, timestampMs: number): void {
    assertSeq(sequence); assertTime(timestampMs);
    if (sequence <= this.lastSequence) throw new Error('BOOK_SEQUENCE_REPLAY');
    if (timestampMs < this.lastTimestampMs) throw new Error('BOOK_TIME_REWIND');
    this.lastSequence = sequence; this.lastTimestampMs = timestampMs;
  }
}
