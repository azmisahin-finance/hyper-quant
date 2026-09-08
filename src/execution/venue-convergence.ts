import { createHash } from 'node:crypto';
import type { BtcTurkWsPrivateEvent } from '../data/btcturk-private-ws.js';
import type { AccountBalance, AccountState, VenueAdapter, VenueOrder } from '../venues/types.js';

const EPSILON = 1e-12;

export type ConvergencePhase = 'AWAITING_REST_SNAPSHOT' | 'REST_ANCHORED' | 'CONVERGED' | 'RESYNC_REQUIRED' | 'DIVERGED' | 'CLOSED';
export type ConvergenceResyncReason =
  | 'RECONNECT'
  | 'PRIVATE_EVENT_GAP'
  | 'PRIVATE_EVENT_BEFORE_REST_BOOTSTRAP'
  | 'PRIVATE_EVENT_AFTER_FINALIZATION'
  | 'PRIVATE_TERMINAL_ORDER_OBSERVED'
  | 'REST_SNAPSHOT_INVALID'
  | 'MANUAL';

export type RestConvergenceSnapshot = {
  /** The local capture time of this pair of read-only REST responses. */
  capturedAtMs: number;
  account: AccountState;
  /** This endpoint attests active orders only; it never proves a terminal order state. */
  openOrders: readonly VenueOrder[];
};

export type ConvergenceDiff = {
  kind:
    | 'ACTIVE_ORDER_MISSING_FROM_REST'
    | 'UNEXPECTED_ACTIVE_ORDER_FROM_REST'
    | 'ORDER_IDENTITY_MISMATCH'
    | 'ORDER_QUANTITY_MISMATCH'
    | 'ORDER_STATUS_MISMATCH'
    | 'ORDER_TIME_MISMATCH'
    | 'TRADE_ID_DUPLICATE'
    | 'TRADE_IDENTITY_MISMATCH'
    | 'TRADE_QUANTITY_MISMATCH'
    | 'TRADE_TIME_MISMATCH'
    | 'PRIVATE_ORDER_NOT_IN_REST_ANCHOR'
    | 'PRIVATE_ORDER_DELETE_REQUIRES_RESYNC'
    | 'PRIVATE_EVENT_UNSUPPORTED'
    | 'PRIVATE_EVENT_BEFORE_REST_BOOTSTRAP'
    | 'PRIVATE_EVENT_AFTER_FINALIZATION'
    | 'UNKNOWN_PRIVATE_ORDER_STATUS'
    | 'REST_SNAPSHOT_TIME_REWIND'
    | 'REST_SNAPSHOT_INVALID';
  orderId?: string;
  evidenceId?: string;
  expected?: string | number;
  observed?: string | number;
};

export type ConvergenceReport = {
  status: Extract<ConvergencePhase, 'CONVERGED' | 'RESYNC_REQUIRED' | 'DIVERGED'>;
  /** Account state is carried exclusively by these REST hashes; WS never manufactures it. */
  accountStateSource: 'REST_ANCHOR_ONLY';
  /** `getOpenOrders` proves active-state convergence only, never FILLED/CANCELLED/etc. */
  activeOrderScope: 'REST_OPEN_ORDERS_ACTIVE_ONLY';
  bootstrapRestAccountAnchorHash: string;
  finalRestAccountAnchorHash: string;
  finalRestActiveOrderHash: string;
  privateEvidenceHash: string;
  privateObservationCount: number;
  resyncReasons: readonly ConvergenceResyncReason[];
  diffs: readonly ConvergenceDiff[];
  reportHash: string;
};

type ActiveOrderStatus = 'ACTIVE' | 'PARTIALLY_FILLED';
type CanonicalActiveOrder = {
  orderId: string;
  clientOrderId: string | null;
  symbol: string;
  side: 'BUY' | 'SELL';
  method: VenueOrder['method'];
  status: ActiveOrderStatus;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  createdAtMs: number;
  updatedAtMs: number;
};
type NormalizedRestSnapshot = {
  capturedAtMs: number;
  account: AccountState;
  accountHash: string;
  openOrders: ReadonlyMap<string, CanonicalActiveOrder>;
  openOrderHash: string;
};
type TradeEvidence = {
  evidenceId: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  clientOrderId: string | null;
  quantity: number;
  price: number;
  timestampMs: number;
};

/**
 * Captures the two read-only REST resources needed for a convergence epoch.
 * Callers can inject a clock for deterministic tests. This function performs no
 * mutation and deliberately does not synthesize account state from WS events.
 */
export async function captureRestConvergenceSnapshot(
  adapter: Pick<VenueAdapter, 'getAccountState' | 'getOpenOrders'>,
  clock: () => number = () => Date.now(),
): Promise<RestConvergenceSnapshot> {
  const [account, openOrders] = await Promise.all([adapter.getAccountState(), adapter.getOpenOrders()]);
  return { capturedAtMs: clock(), account, openOrders };
}

/**
 * Read-only REST/private-WS convergence boundary.
 *
 * The engine has no venue sequence input. `privateObservationCount` is retained
 * for audit only and is intentionally never consulted for temporal ordering.
 * Ordering is accepted only when venue-provided event times and exact order
 * identities/quantities are consistent with an explicit REST anchor.
 */
export class VenueConvergenceEngine {
  private phase: ConvergencePhase = 'AWAITING_REST_SNAPSHOT';
  private anchor: NormalizedRestSnapshot | null = null;
  private readonly workingOrders = new Map<string, CanonicalActiveOrder>();
  private readonly tradeEvidence = new Map<string, TradeEvidence>();
  private readonly lastObservationTimeByOrder = new Map<string, number>();
  private readonly diffs = new Map<string, ConvergenceDiff>();
  private readonly resyncReasons = new Set<ConvergenceResyncReason>();
  private privateObservationCount = 0;
  private finalized: ConvergenceReport | null = null;

  constructor(readonly venueId: string) {
    if (!venueId.trim()) throw new Error('CONVERGENCE_VENUE_ID_REQUIRED');
  }

  getPhase(): ConvergencePhase { return this.phase; }
  requiresResync(): boolean { return this.phase === 'RESYNC_REQUIRED' || this.phase === 'DIVERGED' || this.phase === 'AWAITING_REST_SNAPSHOT'; }

  /**
   * Invalidates the complete convergence epoch. It is not an acknowledgement and
   * cannot make a state trusted again: a fresh `bootstrap` is mandatory.
   */
  markResyncRequired(reason: ConvergenceResyncReason): void {
    if (this.phase === 'CLOSED') throw new Error('CONVERGENCE_ENGINE_CLOSED');
    this.anchor = null;
    this.workingOrders.clear();
    this.tradeEvidence.clear();
    this.lastObservationTimeByOrder.clear();
    this.privateObservationCount = 0;
    this.finalized = null;
    this.resyncReasons.clear();
    this.resyncReasons.add(reason);
    this.phase = 'RESYNC_REQUIRED';
  }

  /** Starts a new REST-anchored epoch and discards all evidence from older epochs. */
  bootstrap(snapshot: RestConvergenceSnapshot): void {
    if (this.phase === 'CLOSED') throw new Error('CONVERGENCE_ENGINE_CLOSED');
    let normalized: NormalizedRestSnapshot;
    try {
      normalized = normalizeRestSnapshot(this.venueId, snapshot);
    } catch (error) {
      this.markResyncRequired('REST_SNAPSHOT_INVALID');
      this.addDiff({ kind: 'REST_SNAPSHOT_INVALID', observed: errorMessage(error) });
      throw error;
    }
    this.anchor = normalized;
    this.workingOrders.clear();
    for (const [id, order] of normalized.openOrders) this.workingOrders.set(id, order);
    this.tradeEvidence.clear();
    this.lastObservationTimeByOrder.clear();
    this.diffs.clear();
    this.resyncReasons.clear();
    this.privateObservationCount = 0;
    this.finalized = null;
    this.phase = 'REST_ANCHORED';
  }

  /**
   * Merges a private WS observation after its session has authenticated it.
   * A WS trade amount is evidence only: it never becomes a cumulative fill until
   * a later exact REST active-order snapshot corroborates it.
   */
  observePrivateEvent(event: BtcTurkWsPrivateEvent): void {
    if (this.phase === 'AWAITING_REST_SNAPSHOT' || this.phase === 'RESYNC_REQUIRED') {
      this.addDiff({ kind: 'PRIVATE_EVENT_BEFORE_REST_BOOTSTRAP' });
      this.markResyncRequired('PRIVATE_EVENT_BEFORE_REST_BOOTSTRAP');
      return;
    }
    if (this.phase === 'CONVERGED' || this.phase === 'CLOSED') {
      this.addDiff({ kind: 'PRIVATE_EVENT_AFTER_FINALIZATION' });
      this.markResyncRequired('PRIVATE_EVENT_AFTER_FINALIZATION');
      return;
    }
    if (this.phase === 'DIVERGED') return;
    this.privateObservationCount += 1;

    switch (event.kind) {
      case 'WS_LOGIN_RESULT':
        // Authentication acknowledgements are session-control messages, not
        // private state evidence. The session normally filters them first, but
        // direct callers receive the same fail-closed boundary.
        this.diverge({ kind: 'PRIVATE_EVENT_UNSUPPORTED', observed: 'WS_LOGIN_RESULT' });
        return;
      case 'USER_TRADE':
        this.observeTrade({
          evidenceId: `TRADE:${event.tradeId}`, orderId: event.orderId, symbol: event.symbol, side: event.side,
          clientOrderId: event.clientOrderId ?? null, quantity: event.amount, price: event.price, timestampMs: event.timestampMs,
        });
        return;
      case 'USER_ORDER_MATCH':
        if (!event.orderId) {
          this.diverge({ kind: 'TRADE_IDENTITY_MISMATCH', evidenceId: `MATCH:${event.eventId}`, expected: 'ORDER_ID', observed: 'MISSING' });
          return;
        }
        this.observeTrade({
          evidenceId: `MATCH:${event.eventId}`, orderId: event.orderId, symbol: event.symbol, side: event.side,
          clientOrderId: event.clientOrderId ?? null, quantity: event.amount, price: event.price, timestampMs: event.timestampMs,
        });
        return;
      case 'ORDER_UPDATE':
        this.observeOrderUpdate(event.order);
        return;
      case 'ORDER_INSERT':
        this.observeOrderInsert(event.order);
        return;
      case 'ORDER_DELETE':
        this.diverge({ kind: 'PRIVATE_ORDER_DELETE_REQUIRES_RESYNC', orderId: event.order.orderId });
        this.resyncReasons.add('PRIVATE_TERMINAL_ORDER_OBSERVED');
        return;
    }
  }

  /** Compares the observed active order state with a fresh REST anchor exactly once per epoch. */
  finalize(snapshot: RestConvergenceSnapshot): ConvergenceReport {
    if (this.finalized) return this.finalized;
    if (!this.anchor) throw new Error('CONVERGENCE_REST_BOOTSTRAP_REQUIRED');
    let finalRest: NormalizedRestSnapshot;
    try {
      finalRest = normalizeRestSnapshot(this.venueId, snapshot);
    } catch (error) {
      this.diverge({ kind: 'REST_SNAPSHOT_INVALID', observed: errorMessage(error) });
      this.resyncReasons.add('REST_SNAPSHOT_INVALID');
      throw error;
    }
    if (finalRest.capturedAtMs < this.anchor.capturedAtMs) {
      this.diverge({ kind: 'REST_SNAPSHOT_TIME_REWIND', expected: this.anchor.capturedAtMs, observed: finalRest.capturedAtMs });
    }

    if (this.phase === 'REST_ANCHORED') this.compareFinalRest(finalRest);
    const status: ConvergenceReport['status'] = this.phase === 'REST_ANCHORED' ? 'CONVERGED' : this.phase === 'RESYNC_REQUIRED' ? 'RESYNC_REQUIRED' : 'DIVERGED';
    if (status === 'CONVERGED') this.phase = 'CONVERGED';

    const orderedDiffs = [...this.diffs.values()].sort(compareDiffs);
    const reportCore = {
      status,
      accountStateSource: 'REST_ANCHOR_ONLY' as const,
      activeOrderScope: 'REST_OPEN_ORDERS_ACTIVE_ONLY' as const,
      bootstrapRestAccountAnchorHash: this.anchor.accountHash,
      finalRestAccountAnchorHash: finalRest.accountHash,
      finalRestActiveOrderHash: finalRest.openOrderHash,
      privateEvidenceHash: hash([...this.tradeEvidence.values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))),
      privateObservationCount: this.privateObservationCount,
      resyncReasons: [...this.resyncReasons].sort(),
      diffs: orderedDiffs,
    };
    this.finalized = { ...reportCore, reportHash: hash(reportCore) };
    return this.finalized;
  }

  close(): void {
    this.anchor = null;
    this.workingOrders.clear();
    this.tradeEvidence.clear();
    this.lastObservationTimeByOrder.clear();
    this.finalized = null;
    this.phase = 'CLOSED';
  }

  private observeOrderInsert(order: VenueOrder): void {
    const observed = this.normalizePrivateActiveOrder(order);
    if (!observed) return;
    if (this.workingOrders.has(observed.orderId)) {
      this.diverge({ kind: 'PRIVATE_ORDER_NOT_IN_REST_ANCHOR', orderId: observed.orderId, expected: 'NEW_ORDER_AFTER_REST_BOOTSTRAP', observed: 'DUPLICATE_INSERT' });
      return;
    }
    // An inserted order might be genuine, but it has no REST anchor for identity
    // or account effects. Do not add it optimistically; demand a new snapshot.
    this.diverge({ kind: 'PRIVATE_ORDER_NOT_IN_REST_ANCHOR', orderId: observed.orderId });
  }

  private observeOrderUpdate(order: VenueOrder): void {
    const observed = this.normalizePrivateActiveOrder(order);
    if (!observed) return;
    const current = this.workingOrders.get(observed.orderId);
    if (!current) {
      this.diverge({ kind: 'PRIVATE_ORDER_NOT_IN_REST_ANCHOR', orderId: observed.orderId });
      return;
    }
    if (!sameIdentity(current, observed)) {
      this.diverge({ kind: 'ORDER_IDENTITY_MISMATCH', orderId: observed.orderId });
      return;
    }
    if (observed.updatedAtMs < current.updatedAtMs || !this.acceptObservationTime(observed.orderId, observed.updatedAtMs)) {
      this.diverge({ kind: 'ORDER_TIME_MISMATCH', orderId: observed.orderId, expected: current.updatedAtMs, observed: observed.updatedAtMs });
      return;
    }
    if (observed.filledQuantity + EPSILON < current.filledQuantity || observed.remainingQuantity > current.remainingQuantity + EPSILON) {
      this.diverge({ kind: 'ORDER_QUANTITY_MISMATCH', orderId: observed.orderId, expected: current.filledQuantity, observed: observed.filledQuantity });
      return;
    }
    this.workingOrders.set(observed.orderId, observed);
  }

  private observeTrade(evidence: TradeEvidence): void {
    const current = this.workingOrders.get(evidence.orderId);
    const anchor = this.anchor?.openOrders.get(evidence.orderId);
    if (!current || !anchor) {
      this.diverge({ kind: 'PRIVATE_ORDER_NOT_IN_REST_ANCHOR', orderId: evidence.orderId, evidenceId: evidence.evidenceId });
      return;
    }
    if (this.tradeEvidence.has(evidence.evidenceId)) {
      this.diverge({ kind: 'TRADE_ID_DUPLICATE', orderId: evidence.orderId, evidenceId: evidence.evidenceId });
      return;
    }
    if (!Number.isFinite(evidence.quantity) || evidence.quantity <= 0 || !Number.isFinite(evidence.price) || evidence.price <= 0) {
      this.diverge({ kind: 'TRADE_QUANTITY_MISMATCH', orderId: evidence.orderId, evidenceId: evidence.evidenceId });
      return;
    }
    if (!sameTradeIdentity(current, evidence)) {
      this.diverge({ kind: 'TRADE_IDENTITY_MISMATCH', orderId: evidence.orderId, evidenceId: evidence.evidenceId });
      return;
    }
    if (!this.acceptObservationTime(evidence.orderId, evidence.timestampMs)) {
      this.diverge({ kind: 'TRADE_TIME_MISMATCH', orderId: evidence.orderId, evidenceId: evidence.evidenceId });
      return;
    }
    const previousQuantity = [...this.tradeEvidence.values()]
      .filter((candidate) => candidate.orderId === evidence.orderId)
      .reduce((sum, candidate) => sum + candidate.quantity, 0);
    if (previousQuantity + evidence.quantity > anchor.remainingQuantity + EPSILON) {
      this.diverge({ kind: 'TRADE_QUANTITY_MISMATCH', orderId: evidence.orderId, evidenceId: evidence.evidenceId, expected: anchor.remainingQuantity, observed: previousQuantity + evidence.quantity });
      return;
    }
    this.tradeEvidence.set(evidence.evidenceId, evidence);
  }

  private normalizePrivateActiveOrder(order: VenueOrder): CanonicalActiveOrder | null {
    try {
      return normalizeActiveOrder(order, 'PRIVATE');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      this.diverge({ kind: 'UNKNOWN_PRIVATE_ORDER_STATUS', orderId: order.orderId, observed: message });
      return null;
    }
  }

  private acceptObservationTime(orderId: string, timestampMs: number): boolean {
    if (!Number.isInteger(timestampMs) || timestampMs < 0 || !this.anchor || timestampMs < this.anchor.capturedAtMs) return false;
    const prior = this.lastObservationTimeByOrder.get(orderId);
    if (prior !== undefined && timestampMs < prior) return false;
    this.lastObservationTimeByOrder.set(orderId, timestampMs);
    return true;
  }

  private compareFinalRest(finalRest: NormalizedRestSnapshot): void {
    for (const [orderId, expected] of this.workingOrders) {
      const observed = finalRest.openOrders.get(orderId);
      if (!observed) {
        this.diverge({ kind: 'ACTIVE_ORDER_MISSING_FROM_REST', orderId });
        continue;
      }
      if (!sameIdentity(expected, observed)) {
        this.diverge({ kind: 'ORDER_IDENTITY_MISMATCH', orderId });
        continue;
      }
      if (observed.updatedAtMs < expected.updatedAtMs) {
        this.diverge({ kind: 'ORDER_TIME_MISMATCH', orderId, expected: expected.updatedAtMs, observed: observed.updatedAtMs });
        continue;
      }
      const anchor = anchorOrder(this.anchor, orderId);
      if (sameState(expected, observed)) {
        if (!this.tradeEvidenceMatchesExactOrder(anchor, expected, orderId)) {
          this.diverge({ kind: 'TRADE_QUANTITY_MISMATCH', orderId, expected: expected.filledQuantity - anchor.filledQuantity });
        }
      } else {
        // Once an exact ORDER_UPDATE has advanced the observed state, a later
        // REST mismatch is not repaired by a trade amount; that amount does not
        // contain a cumulative filledQuantity. A fresh REST epoch is required.
        if (!sameState(expected, anchor) || !this.tradeEvidenceExplains(anchor, observed, orderId)) {
          this.diverge({ kind: 'ORDER_QUANTITY_MISMATCH', orderId, expected: expected.filledQuantity, observed: observed.filledQuantity });
        }
      }
    }
    for (const orderId of finalRest.openOrders.keys()) {
      if (!this.workingOrders.has(orderId)) this.diverge({ kind: 'UNEXPECTED_ACTIVE_ORDER_FROM_REST', orderId });
    }
  }

  private tradeEvidenceExplains(anchor: CanonicalActiveOrder, finalOrder: CanonicalActiveOrder, orderId: string): boolean {
    // Trade/match amounts are not cumulative filled quantities. They only explain
    // an unchanged anchored order when their exact sum is corroborated by REST.
    const evidence = [...this.tradeEvidence.values()].filter((candidate) => candidate.orderId === orderId);
    const total = evidence.reduce((sum, candidate) => sum + candidate.quantity, 0);
    if (evidence.length === 0) return false;
    return nearlyEqual(finalOrder.filledQuantity, anchor.filledQuantity + total)
      && nearlyEqual(finalOrder.remainingQuantity, anchor.remainingQuantity - total);
  }

  private tradeEvidenceMatchesExactOrder(anchor: CanonicalActiveOrder, working: CanonicalActiveOrder, orderId: string): boolean {
    const evidence = [...this.tradeEvidence.values()].filter((candidate) => candidate.orderId === orderId);
    if (evidence.length === 0) return true;
    const total = evidence.reduce((sum, candidate) => sum + candidate.quantity, 0);
    return nearlyEqual(total, working.filledQuantity - anchor.filledQuantity);
  }

  private diverge(diff: ConvergenceDiff): void {
    this.addDiff(diff);
    this.phase = 'DIVERGED';
  }

  private addDiff(diff: ConvergenceDiff): void {
    const key = JSON.stringify([diff.kind, diff.orderId ?? null, diff.evidenceId ?? null, diff.expected ?? null, diff.observed ?? null]);
    this.diffs.set(key, diff);
  }
}

function normalizeRestSnapshot(venueId: string, snapshot: RestConvergenceSnapshot): NormalizedRestSnapshot {
  if (!Number.isInteger(snapshot.capturedAtMs) || snapshot.capturedAtMs < 0) throw new Error('CONVERGENCE_REST_CAPTURE_TIME_INVALID');
  const account = normalizeAccount(venueId, snapshot.account);
  if (account.asOfMs > snapshot.capturedAtMs) throw new Error('CONVERGENCE_REST_ACCOUNT_AFTER_CAPTURE');
  const orders = new Map<string, CanonicalActiveOrder>();
  for (const raw of snapshot.openOrders) {
    const order = normalizeActiveOrder(raw, 'REST');
    if (order.updatedAtMs > snapshot.capturedAtMs) throw new Error('CONVERGENCE_REST_ORDER_AFTER_CAPTURE');
    if (orders.has(order.orderId)) throw new Error(`CONVERGENCE_REST_DUPLICATE_ORDER:${order.orderId}`);
    orders.set(order.orderId, order);
  }
  const sortedOrders = [...orders.values()].sort((a, b) => a.orderId.localeCompare(b.orderId));
  return { capturedAtMs: snapshot.capturedAtMs, account, accountHash: hash(account), openOrders: orders, openOrderHash: hash(sortedOrders) };
}

function normalizeAccount(venueId: string, source: AccountState): AccountState {
  if (source.venueId !== venueId) throw new Error('CONVERGENCE_REST_ACCOUNT_VENUE_MISMATCH');
  if (!Number.isInteger(source.asOfMs) || source.asOfMs < 0) throw new Error('CONVERGENCE_REST_ACCOUNT_TIME_INVALID');
  const balances = new Map<string, AccountBalance>();
  for (const balance of source.balances) {
    const asset = balance.asset.trim().toUpperCase();
    if (!asset || balances.has(asset)) throw new Error('CONVERGENCE_REST_ACCOUNT_ASSET_INVALID');
    if (!Number.isFinite(balance.total) || !Number.isFinite(balance.free) || !Number.isFinite(balance.locked) || balance.total < 0 || balance.free < 0 || balance.locked < 0) throw new Error('CONVERGENCE_REST_ACCOUNT_BALANCE_INVALID');
    if (!Number.isInteger(balance.timestampMs) || balance.timestampMs < 0 || balance.timestampMs > source.asOfMs) throw new Error('CONVERGENCE_REST_ACCOUNT_BALANCE_TIME_INVALID');
    if (!nearlyEqual(balance.free + balance.locked, balance.total)) throw new Error('CONVERGENCE_REST_ACCOUNT_IDENTITY_FAILED');
    balances.set(asset, { asset, total: balance.total, free: balance.free, locked: balance.locked, timestampMs: balance.timestampMs });
  }
  return { venueId, asOfMs: source.asOfMs, balances: [...balances.values()].sort((a, b) => a.asset.localeCompare(b.asset)) };
}

function normalizeActiveOrder(source: VenueOrder, origin: 'REST' | 'PRIVATE'): CanonicalActiveOrder {
  const orderId = source.orderId.trim();
  const symbol = source.symbol.trim().toUpperCase();
  if (!orderId || !symbol) throw new Error(`CONVERGENCE_${origin}_ORDER_IDENTITY_INVALID`);
  if (source.side !== 'BUY' && source.side !== 'SELL') throw new Error(`CONVERGENCE_${origin}_ORDER_SIDE_INVALID`);
  if (!['LIMIT', 'MARKET', 'STOP_LIMIT', 'STOP_MARKET'].includes(source.method)) throw new Error(`CONVERGENCE_${origin}_ORDER_METHOD_INVALID`);
  if (!Number.isFinite(source.quantity) || source.quantity <= 0 || source.filledQuantity === undefined || source.remainingQuantity === undefined) throw new Error(`CONVERGENCE_${origin}_ORDER_QUANTITY_UNVERIFIED`);
  if (!Number.isFinite(source.filledQuantity) || !Number.isFinite(source.remainingQuantity) || source.filledQuantity < 0 || source.remainingQuantity < 0 || !nearlyEqual(source.filledQuantity + source.remainingQuantity, source.quantity)) throw new Error(`CONVERGENCE_${origin}_ORDER_QUANTITY_INVALID`);
  if (!Number.isInteger(source.createdAtMs) || !Number.isInteger(source.updatedAtMs) || source.createdAtMs < 0 || source.updatedAtMs < source.createdAtMs) throw new Error(`CONVERGENCE_${origin}_ORDER_TIME_INVALID`);
  const status = normalizeActiveStatus(source.status, source.filledQuantity);
  const clientOrderId = source.clientOrderId === undefined ? null : source.clientOrderId.trim();
  if (clientOrderId === '') throw new Error(`CONVERGENCE_${origin}_ORDER_CLIENT_ID_INVALID`);
  return { orderId, clientOrderId, symbol, side: source.side, method: source.method, status, quantity: source.quantity, filledQuantity: source.filledQuantity, remainingQuantity: source.remainingQuantity, createdAtMs: source.createdAtMs, updatedAtMs: source.updatedAtMs };
}

function normalizeActiveStatus(value: string, filledQuantity: number): ActiveOrderStatus {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (['OPEN', 'NEW', 'ACCEPTED', 'ACTIVE'].includes(normalized)) {
    if (filledQuantity > EPSILON) throw new Error('CONVERGENCE_UNKNOWN_ORDER_STATUS');
    return 'ACTIVE';
  }
  if (['PARTIAL', 'PARTIALLYFILLED', 'PARTIALLYFILL'].includes(normalized)) {
    if (filledQuantity <= EPSILON) throw new Error('CONVERGENCE_UNKNOWN_ORDER_STATUS');
    return 'PARTIALLY_FILLED';
  }
  // `getOpenOrders` cannot prove a terminal state. Unknown, cancelled, and filled
  // strings therefore remain fail-closed rather than being silently terminalized.
  throw new Error('CONVERGENCE_UNKNOWN_ORDER_STATUS');
}

function sameIdentity(left: CanonicalActiveOrder, right: CanonicalActiveOrder): boolean {
  return left.orderId === right.orderId
    && left.clientOrderId === right.clientOrderId
    && left.symbol === right.symbol
    && left.side === right.side
    && left.method === right.method
    && nearlyEqual(left.quantity, right.quantity)
    && left.createdAtMs === right.createdAtMs;
}

function sameTradeIdentity(order: CanonicalActiveOrder, evidence: TradeEvidence): boolean {
  return order.orderId === evidence.orderId
    && order.clientOrderId === evidence.clientOrderId
    && order.symbol === evidence.symbol.trim().toUpperCase()
    && order.side === evidence.side;
}

function sameState(left: CanonicalActiveOrder, right: CanonicalActiveOrder): boolean {
  return left.status === right.status
    && nearlyEqual(left.filledQuantity, right.filledQuantity)
    && nearlyEqual(left.remainingQuantity, right.remainingQuantity);
}

function anchorOrder(anchor: NormalizedRestSnapshot | null, orderId: string): CanonicalActiveOrder {
  const order = anchor?.openOrders.get(orderId);
  if (!order) throw new Error('CONVERGENCE_ANCHOR_ORDER_MISSING');
  return order;
}

function nearlyEqual(left: number, right: number): boolean { return Math.abs(left - right) <= EPSILON; }
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'UNKNOWN'; }
function compareDiffs(left: ConvergenceDiff, right: ConvergenceDiff): number {
  return JSON.stringify([left.kind, left.orderId ?? '', left.evidenceId ?? '', left.expected ?? '', left.observed ?? ''])
    .localeCompare(JSON.stringify([right.kind, right.orderId ?? '', right.evidenceId ?? '', right.expected ?? '', right.observed ?? '']));
}
