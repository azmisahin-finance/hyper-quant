import { createHash } from 'node:crypto';
import { buildBtcTurkSubscription, parseBtcTurkMarketEvent, type BtcTurkSubscription } from './btcturk-ws.js';
import type { MarketEvent } from '../venues/types.js';

export type SessionPhase = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RESYNC_REQUIRED' | 'CLOSING';

export interface BtcTurkSocket {
  send(message: string): Promise<void>;
  close(code?: number, reason?: string): Promise<void>;
}

export interface BtcTurkSessionHooks {
  onMarketEvent?(event: MarketEvent): Promise<void> | void;
  onResyncRequired?(reason: 'RECONNECT' | 'ORDERBOOK_CHANGESET_GAP'): Promise<void> | void;
  onPhaseChange?(phase: SessionPhase): Promise<void> | void;
}

export type SessionSnapshot = {
  sessionId: string;
  phase: SessionPhase;
  subscriptions: readonly BtcTurkSubscription[];
  marketSequence: number;
  orderBookChangeSets: Readonly<Record<string, number>>;
  needsResync: boolean;
  snapshotHash: string;
};

/**
 * Transport-neutral BtcTurk observation session.
 * It intentionally has no mutation capability: reconnects trigger resync requirements
 * and subscription replay only. Exchange truth must be re-established by REST before
 * dependent state is trusted again.
 */
export class BtcTurkObservationSession {
  private socket: BtcTurkSocket | null = null;
  private phase: SessionPhase = 'DISCONNECTED';
  private readonly subscriptions = new Map<string, BtcTurkSubscription>();
  private readonly orderBookChangeSets = new Map<string, number>();
  private marketSequence = 0;
  private needsResync = true;

  constructor(
    private readonly sessionId: string,
    private readonly hooks: BtcTurkSessionHooks = {},
  ) {
    if (!sessionId.trim()) throw new Error('BTCTURK_SESSION_ID_REQUIRED');
  }

  async connect(socket: BtcTurkSocket): Promise<void> {
    if (this.phase === 'CLOSING') throw new Error('BTCTURK_SESSION_CLOSING');
    this.phase = 'CONNECTING';
    await this.hooks.onPhaseChange?.(this.phase);
    this.socket = socket;
    this.marketSequence = 0;
    this.orderBookChangeSets.clear();
    this.needsResync = true;
    this.phase = 'CONNECTED';
    await this.hooks.onPhaseChange?.(this.phase);
    await this.hooks.onResyncRequired?.('RECONNECT');
    for (const subscription of this.subscriptions.values()) await socket.send(buildBtcTurkSubscription(subscription));
  }

  async disconnect(reason = 'transport closed'): Promise<void> {
    this.socket = null;
    this.needsResync = true;
    this.phase = 'RESYNC_REQUIRED';
    await this.hooks.onPhaseChange?.(this.phase);
    await this.hooks.onResyncRequired?.('RECONNECT');
    void reason;
  }

  async close(): Promise<void> {
    this.phase = 'CLOSING';
    await this.hooks.onPhaseChange?.(this.phase);
    if (this.socket) await this.socket.close(1000, 'session closing');
    this.socket = null;
    this.phase = 'DISCONNECTED';
    await this.hooks.onPhaseChange?.(this.phase);
  }

  async subscribe(subscription: BtcTurkSubscription): Promise<void> {
    const key = `${subscription.channel}:${subscription.event.toUpperCase()}`;
    const normalized = { ...subscription, event: subscription.event.toUpperCase() };
    if (this.subscriptions.has(key)) throw new Error('BTCTURK_SUBSCRIPTION_DUPLICATE');
    this.subscriptions.set(key, normalized);
    if (this.socket && this.phase === 'CONNECTED') await this.socket.send(buildBtcTurkSubscription(normalized));
  }

  async handleMessage(raw: string): Promise<readonly MarketEvent[]> {
    if (this.phase !== 'CONNECTED') throw new Error('BTCTURK_SESSION_NOT_CONNECTED');
    const events = parseBtcTurkMarketEvent(raw);
    this.marketSequence += 1;
    for (const event of events) {
      this.trackOrderBookChangeSet(event);
      await this.hooks.onMarketEvent?.(event);
    }
    return events;
  }

  markResyncComplete(): void {
    if (this.phase !== 'CONNECTED') throw new Error('BTCTURK_SESSION_NOT_CONNECTED');
    this.needsResync = false;
    this.phase = 'CONNECTED';
  }

  requiresResync(): boolean { return this.needsResync; }
  getPhase(): SessionPhase { return this.phase; }

  snapshot(): SessionSnapshot {
    const orderBookChangeSets = Object.fromEntries([...this.orderBookChangeSets.entries()].sort(([a], [b]) => a.localeCompare(b)));
    const core = {
      sessionId: this.sessionId,
      phase: this.phase,
      subscriptions: [...this.subscriptions.values()].sort((a, b) => `${a.channel}:${a.event}`.localeCompare(`${b.channel}:${b.event}`)),
      marketSequence: this.marketSequence,
      orderBookChangeSets,
      needsResync: this.needsResync,
    };
    const snapshotHash = createHash('sha256').update(JSON.stringify(core)).digest('hex');
    return { ...core, snapshotHash };
  }

  private trackOrderBookChangeSet(event: MarketEvent): void {
    if (event.kind !== 'ORDER_BOOK') return;
    const payload = event.payload as { changeSet?: unknown };
    if (typeof payload.changeSet !== 'number' || !Number.isInteger(payload.changeSet) || payload.changeSet < 0) return;
    const previous = this.orderBookChangeSets.get(event.symbol);
    if (previous !== undefined && payload.changeSet !== previous + 1) {
      this.needsResync = true;
      void this.hooks.onResyncRequired?.('ORDERBOOK_CHANGESET_GAP');
    }
    this.orderBookChangeSets.set(event.symbol, payload.changeSet);
  }
}
