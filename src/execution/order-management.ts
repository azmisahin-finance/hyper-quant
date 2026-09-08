import { createHash } from 'node:crypto';

export type ManagedOrderStatus = 'ACTIVE' | 'CANCEL_REQUESTED' | 'CANCELLED' | 'FILLED' | 'REPLACED' | 'UNKNOWN';
export type ManagedOrder = {
  orderId: string;
  clientOrderId: string;
  version: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  originalQuantity: number;
  remainingQuantity: number;
  status: ManagedOrderStatus;
  updatedAtMs: number;
  parentOrderId?: string;
};
export type CancelReplaceRequest = { orderId: string; newPrice: number; newQuantity?: number; requestId: string; timestampMs: number };
export type CancelReplaceResult =
  | { status: 'CANCEL_PENDING'; oldOrderId: string; requestId: string }
  | { status: 'REPLACED'; oldOrderId: string; newOrder: ManagedOrder; requestId: string }
  | { status: 'REJECTED'; oldOrderId: string; requestId: string; reason: string };

const EPS = 1e-12;
function validPositive(n: number): boolean { return Number.isFinite(n) && n > 0; }
function assertTime(n: number): void { if (!Number.isInteger(n) || n < 0) throw new Error('INVALID_ORDER_TIME'); }

export class DeterministicOrderManager {
  private readonly orders = new Map<string, ManagedOrder>();
  private readonly requestIds = new Set<string>();
  private readonly pendingReplacements = new Map<string, { orderId: string; newPrice: number; newQuantity?: number }>();

  create(order: Omit<ManagedOrder, 'version' | 'status' | 'remainingQuantity'>): ManagedOrder {
    if (!order.orderId || !order.clientOrderId || this.orders.has(order.orderId)) throw new Error('DUPLICATE_ORDER_ID');
    if (!validPositive(order.price) || !validPositive(order.originalQuantity)) throw new Error('INVALID_ORDER');
    assertTime(order.updatedAtMs);
    const value: ManagedOrder = { ...order, version: 1, remainingQuantity: order.originalQuantity, status: 'ACTIVE' };
    this.orders.set(value.orderId, value);
    return value;
  }

  applyFill(orderId: string, quantity: number, timestampMs: number): ManagedOrder {
    const current = this.require(orderId); assertTime(timestampMs);
    if (!validPositive(quantity) || quantity > current.remainingQuantity + EPS) throw new Error('FILL_EXCEEDS_REMAINING');
    if (!['ACTIVE', 'CANCEL_REQUESTED'].includes(current.status)) throw new Error('FILL_ON_NON_ACTIVE_ORDER');
    const next: ManagedOrder = { ...current, remainingQuantity: Math.max(0, current.remainingQuantity - quantity), status: quantity >= current.remainingQuantity - EPS ? 'FILLED' : current.status, version: current.version + 1, updatedAtMs: timestampMs };
    this.orders.set(orderId, next); return next;
  }

  requestCancel(orderId: string, timestampMs: number): ManagedOrder {
    const current = this.require(orderId); assertTime(timestampMs);
    if (current.status !== 'ACTIVE') throw new Error('CANCEL_NOT_ALLOWED');
    const next = { ...current, status: 'CANCEL_REQUESTED' as const, version: current.version + 1, updatedAtMs: timestampMs };
    this.orders.set(orderId, next); return next;
  }

  confirmCancel(orderId: string, timestampMs: number): ManagedOrder {
    const current = this.require(orderId); assertTime(timestampMs);
    if (current.status !== 'CANCEL_REQUESTED') throw new Error('CANCEL_CONFIRM_NOT_ALLOWED');
    if (current.remainingQuantity <= EPS) throw new Error('CANCEL_AFTER_FULL_FILL');
    const next = { ...current, status: 'CANCELLED' as const, version: current.version + 1, updatedAtMs: timestampMs };
    this.orders.set(orderId, next); return next;
  }

  startCancelReplace(request: CancelReplaceRequest): CancelReplaceResult {
    if (!request.requestId || this.requestIds.has(request.requestId)) return { status: 'REJECTED', oldOrderId: request.orderId, requestId: request.requestId, reason: 'REPLACE_REQUEST_REPLAY' };
    this.requestIds.add(request.requestId);
    const current = this.require(request.orderId);
    assertTime(request.timestampMs);
    if (current.status !== 'ACTIVE') return { status: 'REJECTED', oldOrderId: current.orderId, requestId: request.requestId, reason: 'ORDER_NOT_REPLACEABLE_UNTIL_CANCEL_CONFIRMED' };
    if (!validPositive(request.newPrice)) return { status: 'REJECTED', oldOrderId: current.orderId, requestId: request.requestId, reason: 'INVALID_REPLACEMENT_PRICE' };
    if (request.newQuantity !== undefined && (!validPositive(request.newQuantity) || request.newQuantity > current.remainingQuantity + EPS)) {
      return { status: 'REJECTED', oldOrderId: current.orderId, requestId: request.requestId, reason: 'INVALID_REPLACEMENT_QUANTITY' };
    }
    this.pendingReplacements.set(request.requestId, { orderId: current.orderId, newPrice: request.newPrice, newQuantity: request.newQuantity });
    this.orders.set(current.orderId, { ...current, status: 'CANCEL_REQUESTED', version: current.version + 1, updatedAtMs: request.timestampMs });
    return { status: 'CANCEL_PENDING', oldOrderId: current.orderId, requestId: request.requestId };
  }

  completeCancelReplace(oldOrderId: string, request: CancelReplaceRequest, timestampMs: number): CancelReplaceResult {
    assertTime(timestampMs);
    if (!this.requestIds.has(request.requestId)) return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'UNKNOWN_REPLACE_REQUEST' };
    const pending = this.pendingReplacements.get(request.requestId);
    if (!pending || pending.orderId !== oldOrderId) return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'REPLACE_REQUEST_CONTEXT_MISMATCH' };
    if (pending.newPrice !== request.newPrice || pending.newQuantity !== request.newQuantity) return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'REPLACE_REQUEST_TAMPERED' };
    const current = this.require(oldOrderId);
    if (current.status === 'FILLED') return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'LATE_FILL_CONSUMED_REPLACEMENT' };
    if (current.status !== 'CANCEL_REQUESTED') return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'CANCEL_REPLACE_NOT_PENDING' };
    if (!validPositive(request.newPrice)) return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'INVALID_REPLACEMENT_PRICE' };
    if (current.remainingQuantity <= EPS) return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'NO_REMAINING_QUANTITY' };
    const replacementQuantity = pending.newQuantity ?? current.remainingQuantity;
    if (!validPositive(replacementQuantity) || replacementQuantity > current.remainingQuantity + EPS) return { status: 'REJECTED', oldOrderId, requestId: request.requestId, reason: 'INVALID_REPLACEMENT_QUANTITY' };
    const nextVersion = current.version + 1;
    const newOrder: ManagedOrder = {
      orderId: `${current.orderId}:v${nextVersion}`,
      clientOrderId: `${current.clientOrderId}:v${nextVersion}`,
      version: 1,
      symbol: current.symbol,
      side: current.side,
      price: request.newPrice,
      originalQuantity: replacementQuantity,
      remainingQuantity: replacementQuantity,
      status: 'ACTIVE',
      updatedAtMs: timestampMs,
      parentOrderId: current.orderId,
    };
    this.orders.set(current.orderId, { ...current, status: 'REPLACED', version: nextVersion, updatedAtMs: timestampMs });
    this.orders.set(newOrder.orderId, newOrder);
    this.pendingReplacements.delete(request.requestId);
    return { status: 'REPLACED', oldOrderId, newOrder, requestId: request.requestId };
  }

  get(orderId: string): ManagedOrder | null { return this.orders.get(orderId) ?? null; }
  digest(orderId: string): string { const order = this.require(orderId); return createHash('sha256').update(JSON.stringify(order)).digest('hex'); }
  private require(orderId: string): ManagedOrder { const order = this.orders.get(orderId); if (!order) throw new Error('ORDER_NOT_FOUND'); return order; }
}
