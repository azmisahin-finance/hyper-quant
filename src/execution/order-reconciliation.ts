import { applyReconciledSnapshot, type LifecycleStatus, type OrderLifecycleState } from './order-lifecycle.js';

export type RemoteOrderSnapshot = {
  orderId: string;
  status: Exclude<LifecycleStatus, 'NEW' | 'CANCEL_REQUESTED' | 'UNKNOWN'>;
  filledQuantity: number;
  remainingQuantity: number;
  updatedAtMs: number;
  fillIds?: readonly string[];
};

export type OrderReconciliationDecision =
  | { status: 'NOOP_CONFIRMED' }
  | { status: 'APPLY_REMOTE_STATE'; snapshot: RemoteOrderSnapshot }
  | { status: 'UNKNOWN_REQUIRES_RECONCILIATION'; reason: string };

export function reconcileOrder(local: OrderLifecycleState, remote: RemoteOrderSnapshot | null): OrderReconciliationDecision {
  if (!remote) return { status: 'UNKNOWN_REQUIRES_RECONCILIATION', reason: 'REMOTE_ORDER_NOT_FOUND_OR_UNAVAILABLE' };
  if (remote.orderId !== local.orderId) return { status: 'UNKNOWN_REQUIRES_RECONCILIATION', reason: 'REMOTE_ORDER_ID_MISMATCH' };
  if (!Number.isFinite(remote.filledQuantity) || remote.filledQuantity < 0 || remote.filledQuantity > local.quantity + 1e-12) {
    return { status: 'UNKNOWN_REQUIRES_RECONCILIATION', reason: 'REMOTE_FILLED_QUANTITY_INVALID' };
  }
  if (!Number.isFinite(remote.remainingQuantity) || remote.remainingQuantity < 0) {
    return { status: 'UNKNOWN_REQUIRES_RECONCILIATION', reason: 'REMOTE_REMAINING_QUANTITY_INVALID' };
  }
  if (Math.abs((remote.filledQuantity + remote.remainingQuantity) - local.quantity) > 1e-9) {
    return { status: 'UNKNOWN_REQUIRES_RECONCILIATION', reason: 'REMOTE_QUANTITY_IDENTITY_FAILED' };
  }
  if (remote.updatedAtMs < local.updatedAtMs) return { status: 'UNKNOWN_REQUIRES_RECONCILIATION', reason: 'REMOTE_SNAPSHOT_STALE' };
  if (remote.status === local.status && Math.abs(remote.filledQuantity - local.filledQuantity) <= 1e-12 && Math.abs(remote.remainingQuantity - local.remainingQuantity) <= 1e-12) {
    return { status: 'NOOP_CONFIRMED' };
  }
  return { status: 'APPLY_REMOTE_STATE', snapshot: remote };
}

export function applyReconciliation(local: OrderLifecycleState, remote: RemoteOrderSnapshot): OrderLifecycleState {
  return applyReconciledSnapshot(local, remote);
}
