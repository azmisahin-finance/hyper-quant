import { buildBtcTurkWsHmacLogin, parseBtcTurkPrivateEvent, type BtcTurkWsAuthMaterial, type BtcTurkWsPrivateEvent } from './btcturk-private-ws.js';
import type { BtcTurkSocket } from './btcturk-ws-session.js';

export type PrivateSessionPhase = 'DISCONNECTED' | 'CONNECTING' | 'AUTHENTICATING' | 'AUTHENTICATED' | 'RESYNC_REQUIRED' | 'CLOSING';
export interface PrivateSessionHooks { onEvent?(event: BtcTurkWsPrivateEvent): Promise<void> | void; onResyncRequired?(reason: 'RECONNECT' | 'PRIVATE_EVENT_GAP'): Promise<void> | void; onPhaseChange?(phase: PrivateSessionPhase): Promise<void> | void; }
export type PrivateSessionSnapshot = { sessionId: string; phase: PrivateSessionPhase; authenticated: boolean; privateObservationCount: number; needsResync: boolean };

/** Private observation only. It never submits/cancels/modifies orders. */
export class BtcTurkPrivateObservationSession {
  private socket: BtcTurkSocket | null = null;
  private phase: PrivateSessionPhase = 'DISCONNECTED';
  private authenticated = false;
  // This is an audit-only local counter. BtcTurk private payloads do not prove a
  // venue sequence, so this value must never be used for ordering or convergence.
  private privateObservationCount = 0;
  private needsResync = true;

  constructor(private readonly sessionId: string, private readonly hooks: PrivateSessionHooks = {}) {
    if (!sessionId.trim()) throw new Error('BTCTURK_PRIVATE_SESSION_ID_REQUIRED');
  }

  async connect(socket: BtcTurkSocket, auth: BtcTurkWsAuthMaterial): Promise<void> {
    if (this.phase === 'CLOSING') throw new Error('BTCTURK_PRIVATE_SESSION_CLOSING');
    this.phase = 'CONNECTING'; await this.hooks.onPhaseChange?.(this.phase);
    this.socket = socket; this.authenticated = false; this.privateObservationCount = 0; this.needsResync = true;
    this.phase = 'AUTHENTICATING'; await this.hooks.onPhaseChange?.(this.phase);
    await socket.send(buildBtcTurkWsHmacLogin(auth));
  }

  async disconnect(): Promise<void> {
    this.socket = null; this.authenticated = false; this.needsResync = true; this.phase = 'RESYNC_REQUIRED';
    await this.hooks.onPhaseChange?.(this.phase); await this.hooks.onResyncRequired?.('RECONNECT');
  }

  async close(): Promise<void> {
    this.phase = 'CLOSING'; await this.hooks.onPhaseChange?.(this.phase); if (this.socket) await this.socket.close(1000, 'session closing');
    this.socket = null; this.authenticated = false; this.phase = 'DISCONNECTED'; await this.hooks.onPhaseChange?.(this.phase);
  }

  async handleMessage(raw: string): Promise<readonly BtcTurkWsPrivateEvent[]> {
    if (!this.socket || (this.phase !== 'AUTHENTICATING' && this.phase !== 'AUTHENTICATED')) throw new Error('BTCTURK_PRIVATE_SESSION_NOT_CONNECTED');
    const events = parseBtcTurkPrivateEvent(raw);
    for (const event of events) {
      if (event.kind === 'WS_LOGIN_RESULT') {
        if (this.phase !== 'AUTHENTICATING' || this.authenticated) throw new Error('BTCTURK_PRIVATE_LOGIN_EVENT_OUTSIDE_AUTHENTICATION');
        this.privateObservationCount += 1;
        if (!event.ok) {
          this.authenticated = false; this.needsResync = true; this.phase = 'RESYNC_REQUIRED';
          await this.hooks.onPhaseChange?.(this.phase); await this.hooks.onResyncRequired?.('RECONNECT');
          throw new Error(`BTCTURK_PRIVATE_LOGIN_REJECTED:${event.message ?? 'UNKNOWN'}`);
        }
        this.authenticated = true; this.phase = 'AUTHENTICATED'; await this.hooks.onPhaseChange?.(this.phase);
        // A handshake acknowledgement is not an account/order observation and is
        // deliberately never forwarded to the convergence consumer.
        continue;
      }
      if (!this.authenticated || this.phase !== 'AUTHENTICATED') throw new Error('BTCTURK_PRIVATE_EVENT_BEFORE_AUTHENTICATION');
      this.privateObservationCount += 1;
      await this.hooks.onEvent?.(event);
    }
    return events;
  }

  markResyncComplete(): void { if (this.phase !== 'AUTHENTICATED') throw new Error('BTCTURK_PRIVATE_NOT_AUTHENTICATED'); this.needsResync = false; }
  requiresResync(): boolean { return this.needsResync; }
  getPhase(): PrivateSessionPhase { return this.phase; }
  snapshot(): PrivateSessionSnapshot { return { sessionId: this.sessionId, phase: this.phase, authenticated: this.authenticated, privateObservationCount: this.privateObservationCount, needsResync: this.needsResync }; }
}
