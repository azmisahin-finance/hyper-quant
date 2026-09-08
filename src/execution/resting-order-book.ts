import type { BookSide, DeterministicOrderBook } from './order-book.js';

export type RestingOrder = {
  orderId: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  remainingQuantity: number;
  queueAhead: number;
  sequence: number;
};
export type RestingFill = { orderId: string; quantity: number; price: number; sequence: number };

const EPS = 1e-12;
function positive(n: number): boolean { return Number.isFinite(n) && n > 0; }

export class QueueAwareRestingOrderModel {
  private readonly orders = new Map<string, RestingOrder>();

  place(order: { orderId: string; side: 'BUY' | 'SELL'; price: number; quantity: number }, book: DeterministicOrderBook): RestingOrder {
    if (!order.orderId || this.orders.has(order.orderId)) throw new Error('RESTING_ORDER_DUPLICATE');
    if (!positive(order.price) || !positive(order.quantity)) throw new Error('RESTING_ORDER_INVALID');
    const estimate = book.estimateQueue(order.side, order.price, order.quantity);
    const value: RestingOrder = { ...order, remainingQuantity: order.quantity, queueAhead: estimate.queueAhead, sequence: estimate.sequence };
    this.orders.set(order.orderId, value);
    return value;
  }

  applyCancellationAhead(input: { side: 'BUY' | 'SELL'; price: number; quantity: number; sequence: number }): void {
    if (!positive(input.quantity) || !Number.isInteger(input.sequence) || input.sequence < 1) throw new Error('RESTING_EVENT_INVALID');
    for (const [id, order] of this.orders) {
      if (order.side === input.side && order.price === input.price) {
        const next = { ...order, queueAhead: Math.max(0, order.queueAhead - input.quantity), sequence: input.sequence };
        this.orders.set(id, next);
      }
    }
  }

  consumeTrade(input: { side: BookSide; price: number; quantity: number; sequence: number }): RestingFill[] {
    if (!positive(input.price) || !positive(input.quantity) || !Number.isInteger(input.sequence) || input.sequence < 1) throw new Error('RESTING_EVENT_INVALID');
    const fills: RestingFill[] = [];
    const desiredSide = input.side === 'ASK' ? 'SELL' : 'BUY';
    for (const [id, order] of this.orders) {
      if (order.side !== desiredSide || order.price !== input.price || order.remainingQuantity <= EPS) continue;
      let flow = input.quantity;
      let queueAhead = order.queueAhead;
      if (flow <= queueAhead + EPS) {
        this.orders.set(id, { ...order, queueAhead: Math.max(0, queueAhead - flow), sequence: input.sequence });
        continue;
      }
      flow -= queueAhead;
      queueAhead = 0;
      const filled = Math.min(order.remainingQuantity, flow);
      if (filled > EPS) {
        fills.push({ orderId: id, quantity: filled, price: order.price, sequence: input.sequence });
      }
      const next = { ...order, remainingQuantity: Math.max(0, order.remainingQuantity - filled), queueAhead, sequence: input.sequence };
      if (next.remainingQuantity <= EPS) this.orders.delete(id); else this.orders.set(id, next);
    }
    return fills;
  }

  get(orderId: string): RestingOrder | null { return this.orders.get(orderId) ?? null; }
}
