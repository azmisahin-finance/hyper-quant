import { createHash } from 'node:crypto';

export type LifecycleStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'UNKNOWN';

export type OrderLifecycleState = {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: LifecycleStatus;
  updatedAtMs: number;
  version: number;
  lastEventSeq: number;
  appliedFillIds: readonly string[];
};

export type OrderEvent =
  | { seq: number; timestampMs: number; type: 'ORDER_CREATED'; orderId: string; clientOrderId?: string; symbol: string; side: 'BUY' | 'SELL'; quantity: number }
  | { seq: number; timestampMs: number; type: 'ORDER_ACCEPTED'; orderId: string }
  | { seq: number; timestampMs: number; type: 'ORDER_FILL'; orderId: string; fillId: string; quantity: number }
  | { seq: number; timestampMs: number; type: 'CANCEL_REQUESTED'; orderId: string }
  | { seq: number; timestampMs: number; type: 'ORDER_CANCELLED'; orderId: string }
  | { seq: number; timestampMs: number; type: 'ORDER_REJECTED'; orderId: string; reason: string }
  | { seq: number; timestampMs: number; type: 'ORDER_EXPIRED'; orderId: string }
  | { seq: number; timestampMs: number; type: 'ORDER_UNKNOWN'; orderId: string; reason: string };

type TerminalStatus = 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
const terminal = new Set<TerminalStatus>(['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED']);

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function assertTimestamp(timestampMs: number): void {
  if (!Number.isInteger(timestampMs) || timestampMs < 0) throw new Error('INVALID_EVENT_TIMESTAMP');
}

function assertMonotonicEvent(current: OrderLifecycleState, event: OrderEvent): void {
  assertTimestamp(event.timestampMs);
  if (event.seq <= current.lastEventSeq) throw new Error('OUT_OF_ORDER_OR_REPLAYED_EVENT');
  if (event.timestampMs < current.updatedAtMs) throw new Error('NON_MONOTONIC_EVENT_TIME');
}

function assertStatusAllows(status: LifecycleStatus, event: OrderEvent): void {
  if (status === 'UNKNOWN') {
    if (event.type !== 'ORDER_UNKNOWN') throw new Error('UNKNOWN_ORDER_REQUIRES_RECONCILIATION');
    return;
  }
  if (terminal.has(status as TerminalStatus) && event.type !== 'ORDER_UNKNOWN') {
    throw new Error('TERMINAL_ORDER_MUTATION_FORBIDDEN');
  }
  if (event.type === 'ORDER_ACCEPTED' && status !== 'NEW') throw new Error('INVALID_ACCEPT_TRANSITION');
  if (event.type === 'ORDER_FILL' && !['ACCEPTED', 'PARTIALLY_FILLED', 'CANCEL_REQUESTED'].includes(status)) throw new Error('INVALID_FILL_TRANSITION');
  if (event.type === 'CANCEL_REQUESTED' && !['ACCEPTED', 'PARTIALLY_FILLED'].includes(status)) throw new Error('INVALID_CANCEL_REQUEST_TRANSITION');
  if (event.type === 'ORDER_CANCELLED' && status !== 'CANCEL_REQUESTED') throw new Error('INVALID_CANCEL_TRANSITION');
  if (event.type === 'ORDER_REJECTED' && status !== 'NEW') throw new Error('INVALID_REJECT_TRANSITION');
  if (event.type === 'ORDER_EXPIRED' && !['NEW', 'ACCEPTED', 'PARTIALLY_FILLED', 'CANCEL_REQUESTED'].includes(status)) throw new Error('INVALID_EXPIRE_TRANSITION');
}

export function createLifecycleState(event: Extract<OrderEvent, { type: 'ORDER_CREATED' }>): OrderLifecycleState {
  assertTimestamp(event.timestampMs);
  if (!event.orderId || !event.symbol || !finitePositive(event.quantity)) throw new Error('INVALID_ORDER_CREATED');
  if (event.seq < 1) throw new Error('INVALID_EVENT_SEQUENCE');
  return {
    orderId: event.orderId,
    ...(event.clientOrderId ? { clientOrderId: event.clientOrderId } : {}),
    symbol: event.symbol,
    side: event.side,
    quantity: event.quantity,
    filledQuantity: 0,
    remainingQuantity: event.quantity,
    status: 'NEW',
    updatedAtMs: event.timestampMs,
    version: 1,
    lastEventSeq: event.seq,
    appliedFillIds: [],
  };
}

export function applyOrderEvent(current: OrderLifecycleState, event: OrderEvent): OrderLifecycleState {
  if (event.orderId !== current.orderId) throw new Error('ORDER_ID_MISMATCH');
  assertMonotonicEvent(current, event);
  assertStatusAllows(current.status, event);

  let next: OrderLifecycleState = { ...current, updatedAtMs: event.timestampMs, version: current.version + 1, lastEventSeq: event.seq };

  switch (event.type) {
    case 'ORDER_ACCEPTED':
      next.status = 'ACCEPTED';
      break;
    case 'ORDER_FILL': {
      if (!finitePositive(event.quantity)) throw new Error('INVALID_FILL_QUANTITY');
      if (current.appliedFillIds.includes(event.fillId)) throw new Error('FILL_REPLAY');
      if (event.quantity > current.remainingQuantity + 1e-12) throw new Error('FILL_EXCEEDS_REMAINING');
      next.filledQuantity = current.filledQuantity + event.quantity;
      next.remainingQuantity = Math.max(0, current.remainingQuantity - event.quantity);
      next.status = next.remainingQuantity <= 1e-12 ? 'FILLED' : 'PARTIALLY_FILLED';
      next.appliedFillIds = [...current.appliedFillIds, event.fillId];
      break;
    }
    case 'CANCEL_REQUESTED':
      next.status = 'CANCEL_REQUESTED';
      break;
    case 'ORDER_CANCELLED':
      next.status = 'CANCELLED';
      break;
    case 'ORDER_REJECTED':
      next.status = 'REJECTED';
      break;
    case 'ORDER_EXPIRED':
      next.status = 'EXPIRED';
      break;
    case 'ORDER_UNKNOWN':
      next.status = 'UNKNOWN';
      break;
    case 'ORDER_CREATED':
      throw new Error('ORDER_ALREADY_CREATED');
  }

  return next;
}

export function applyReconciledSnapshot(current: OrderLifecycleState, snapshot: {
  orderId: string;
  status: Exclude<LifecycleStatus, 'NEW' | 'CANCEL_REQUESTED' | 'UNKNOWN'>;
  filledQuantity: number;
  remainingQuantity: number;
  updatedAtMs: number;
  fillIds?: readonly string[];
}): OrderLifecycleState {
  if (snapshot.orderId !== current.orderId) throw new Error('REMOTE_ORDER_ID_MISMATCH');
  if (snapshot.updatedAtMs < current.updatedAtMs) throw new Error('REMOTE_SNAPSHOT_STALE');
  if (!Number.isFinite(snapshot.filledQuantity) || snapshot.filledQuantity < 0 || snapshot.filledQuantity > current.quantity + 1e-12) throw new Error('REMOTE_FILLED_QUANTITY_INVALID');
  if (!Number.isFinite(snapshot.remainingQuantity) || snapshot.remainingQuantity < 0) throw new Error('REMOTE_REMAINING_QUANTITY_INVALID');
  if (Math.abs(snapshot.filledQuantity + snapshot.remainingQuantity - current.quantity) > 1e-9) throw new Error('REMOTE_QUANTITY_IDENTITY_FAILED');
  if (snapshot.status === 'FILLED' && snapshot.remainingQuantity > 1e-12) throw new Error('REMOTE_FILLED_WITH_REMAINDER');
  if (snapshot.status !== 'FILLED' && snapshot.remainingQuantity <= 1e-12) throw new Error('REMOTE_TERMINAL_QUANTITY_MISMATCH');
  const fillIds = snapshot.fillIds ? [...new Set(snapshot.fillIds)] : current.appliedFillIds;
  if (fillIds.length > snapshot.filledQuantity + 1e-12) throw new Error('REMOTE_FILL_IDENTITY_UNVERIFIED');
  return {
    ...current,
    status: snapshot.status,
    filledQuantity: snapshot.filledQuantity,
    remainingQuantity: snapshot.remainingQuantity,
    updatedAtMs: snapshot.updatedAtMs,
    version: current.version + 1,
    lastEventSeq: current.lastEventSeq,
    appliedFillIds: fillIds,
  };
}

export function lifecycleDigest(state: OrderLifecycleState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

export function resetLifecycleTestIdentity(): void {
  // Kept for backward-compatible tests; lifecycle identity is now state-local.
}
