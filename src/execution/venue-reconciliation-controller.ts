import { createHash } from 'node:crypto';
import type { AccountState, OrderReference, VenueAdapter, VenueOrder } from '../venues/types.js';
import type { OrderLifecycleState } from './order-lifecycle.js';
import { reconcileOrder, type OrderReconciliationDecision, type RemoteOrderSnapshot } from './order-reconciliation.js';

export type ObservationGap = {
  connectionId: string;
  expectedSequence: number;
  receivedSequence: number;
  reason: 'SEQUENCE_GAP' | 'RECONNECT';
};

export type ReconciliationDiff = {
  kind: 'ORDER_MISSING' | 'ORDER_STATUS_MISMATCH' | 'ORDER_QUANTITY_MISMATCH' | 'ACCOUNT_ASSET_MISMATCH' | 'ACCOUNT_TOTAL_MISMATCH';
  orderId?: string;
  asset?: string;
  local?: string | number;
  remote?: string | number;
};

export type VenueReconciliationReport = {
  asOfMs: number;
  source: 'PRIVATE_REST';
  fresh: boolean;
  diffs: readonly ReconciliationDiff[];
  orderDecisions: readonly { orderId: string; decision: OrderReconciliationDecision }[];
  accountHash: string;
  reportHash: string;
};

export class VenueObservationTracker {
  private connectionId: string | null = null;
  private lastSequence = 0;
  private gap: ObservationGap | null = null;

  start(connectionId: string): void {
    if (!connectionId.trim()) throw new Error('VENUE_CONNECTION_ID_REQUIRED');
    this.connectionId = connectionId;
    this.lastSequence = 0;
    this.gap = { connectionId, expectedSequence: 1, receivedSequence: 0, reason: 'RECONNECT' };
  }

  accept(sequence: number): void {
    if (!this.connectionId) throw new Error('VENUE_CONNECTION_NOT_STARTED');
    if (!Number.isInteger(sequence) || sequence < 1) throw new Error('INVALID_VENUE_SEQUENCE');
    if (sequence <= this.lastSequence) throw new Error('VENUE_SEQUENCE_REPLAY');
    if (sequence !== this.lastSequence + 1) {
      this.gap = { connectionId: this.connectionId, expectedSequence: this.lastSequence + 1, receivedSequence: sequence, reason: 'SEQUENCE_GAP' };
      this.lastSequence = sequence;
      return;
    }
    this.lastSequence = sequence;
    if (this.gap?.reason === 'RECONNECT' && sequence === 1) this.gap = null;
  }

  requiresResync(): boolean { return this.gap !== null; }
  consumeGap(): ObservationGap | null { const gap = this.gap; this.gap = null; return gap; }
}

export type AccountReconciliationInput = {
  local: AccountState;
  remote: AccountState;
};

export function reconcileAccount(input: AccountReconciliationInput): ReconciliationDiff[] {
  if (input.remote.venueId !== input.local.venueId) throw new Error('ACCOUNT_VENUE_MISMATCH');
  if (input.remote.asOfMs < input.local.asOfMs) throw new Error('ACCOUNT_SNAPSHOT_STALE');
  const local = new Map(input.local.balances.map((b) => [b.asset, b]));
  const remote = new Map(input.remote.balances.map((b) => [b.asset, b]));
  const diffs: ReconciliationDiff[] = [];
  const assets = new Set([...local.keys(), ...remote.keys()]);
  for (const asset of [...assets].sort()) {
    const l = local.get(asset);
    const r = remote.get(asset);
    if (!l || !r) {
      diffs.push({ kind: 'ACCOUNT_ASSET_MISMATCH', asset, local: l?.total ?? 'MISSING', remote: r?.total ?? 'MISSING' });
      continue;
    }
    if (Math.abs(l.total - r.total) > 1e-12) diffs.push({ kind: 'ACCOUNT_TOTAL_MISMATCH', asset, local: l.total, remote: r.total });
    if (Math.abs((r.free + r.locked) - r.total) > 1e-12) diffs.push({ kind: 'ACCOUNT_TOTAL_MISMATCH', asset, local: l.total, remote: 'REMOTE_FREE_PLUS_LOCKED_IDENTITY_FAILED' });
  }
  return diffs;
}

export function venueOrderToRemoteSnapshot(order: VenueOrder): RemoteOrderSnapshot {
  const status = normalizeVenueStatus(order.status);
  if (order.filledQuantity === undefined || order.remainingQuantity === undefined) {
    throw new Error('VENUE_FILLED_QUANTITY_UNVERIFIED');
  }
  if (!Number.isFinite(order.filledQuantity) || order.filledQuantity < 0 || !Number.isFinite(order.remainingQuantity) || order.remainingQuantity < 0) {
    throw new Error('VENUE_QUANTITY_INVALID');
  }
  return { orderId: order.orderId, status, filledQuantity: order.filledQuantity, remainingQuantity: order.remainingQuantity, updatedAtMs: order.updatedAtMs };
}

function normalizeVenueStatus(status: string): RemoteOrderSnapshot['status'] {
  const value = status.trim().toLowerCase();
  if (value === 'filled') return 'FILLED';
  if (value === 'canceled' || value === 'cancelled') return 'CANCELLED';
  if (value === 'rejected') return 'REJECTED';
  if (value === 'expired') return 'EXPIRED';
  if (value === 'partial' || value === 'partiallyfilled' || value === 'partially_filled') return 'PARTIALLY_FILLED';
  throw new Error(`VENUE_UNSUPPORTED_ORDER_STATUS:${status}`);
}

export class VenueReconciliationController {
  constructor(private readonly adapter: VenueAdapter) {}

  async reconcileOrders(localOrders: readonly OrderLifecycleState[], asOfMs = Date.now()): Promise<VenueReconciliationReport> {
    if (!Number.isInteger(asOfMs) || asOfMs < 0) throw new Error('INVALID_RECONCILIATION_TIME');
    const decisions: { orderId: string; decision: OrderReconciliationDecision }[] = [];
    const diffs: ReconciliationDiff[] = [];

    for (const local of localOrders) {
      const ref: OrderReference = { venueId: 'btcturk', orderId: local.orderId };
      const remote = await this.adapter.getOrder(ref);
      if ('kind' in remote) {
        decisions.push({ orderId: local.orderId, decision: { status: 'UNKNOWN_REQUIRES_RECONCILIATION', reason: remote.reason } });
        diffs.push({ kind: 'ORDER_MISSING', orderId: local.orderId, local: local.status, remote: 'UNKNOWN' });
        continue;
      }
      const snapshot: RemoteOrderSnapshot = venueOrderToRemoteSnapshot(remote);
      const decision = reconcileOrder(local, snapshot);
      decisions.push({ orderId: local.orderId, decision });
      if (decision.status === 'UNKNOWN_REQUIRES_RECONCILIATION') diffs.push({ kind: 'ORDER_STATUS_MISMATCH', orderId: local.orderId, local: local.status, remote: remote.status });
      if (decision.status === 'APPLY_REMOTE_STATE' && snapshot.filledQuantity !== local.filledQuantity) diffs.push({ kind: 'ORDER_QUANTITY_MISMATCH', orderId: local.orderId, local: local.filledQuantity, remote: snapshot.filledQuantity });
    }

    const account = await this.adapter.getAccountState();
    const accountHash = createHash('sha256').update(JSON.stringify(account)).digest('hex');
    const reportHash = createHash('sha256').update(JSON.stringify({ asOfMs, source: 'PRIVATE_REST', diffs, decisions, accountHash })).digest('hex');
    return { asOfMs, source: 'PRIVATE_REST', fresh: true, diffs, orderDecisions: decisions, accountHash, reportHash };
  }
}
