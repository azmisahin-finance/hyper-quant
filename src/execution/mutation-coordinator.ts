import type { ExecutionBarrier } from './barrier.js';
import { NoOpBarrier } from './barrier.js';

export type KillType =
  | 'SYSTEM_KILL'
  | 'RESEARCH_INTEGRITY_KILL'
  | 'VENUE_KILL'
  | 'DATA_KILL'
  | 'MODEL_KILL'
  | 'STRATEGY_KILL';

export type MutationScope = {
  venueId: string;
  strategyId: string;
  instrumentId: string;
  dataDependencies?: string[];
};

export type VersionedSafetyState = {
  killStateVersion: number;
  dependencyGraphVersion: number;
  riskAuthorizationVersion: number;
  executionPolicyVersion: number;
  kills: ReadonlySet<KillType>;
};

export type AuthorizationSnapshot = {
  target: MutationScope;
  killStateVersion: number;
  dependencyGraphVersion: number;
  riskAuthorizationVersion: number;
  executionPolicyVersion: number;
  nonce: string;
  expiresAt: number;
};

export type DenialReason =
  | 'STALE_AUTHORIZATION'
  | 'SNAPSHOT_REPLAY'
  | 'EXPIRED_AUTHORIZATION'
  | 'APPLICABLE_KILL_ACTIVE';

export type MutationResult =
  | { status: 'DENIED'; reason: DenialReason }
  | { status: 'IN_FLIGHT'; nonce: string }
  | { status: 'SUBMITTED_CONFIRMED'; nonce: string; remoteId: string };

export interface MutationExecutor {
  submit(snapshot: AuthorizationSnapshot): Promise<{ status: 'UNKNOWN' } | { status: 'CONFIRMED'; remoteId: string }>;
}

function applicableKill(state: VersionedSafetyState, target: MutationScope): KillType | undefined {
  if (state.kills.has('SYSTEM_KILL')) return 'SYSTEM_KILL';
  if (state.kills.has('VENUE_KILL')) return 'VENUE_KILL';
  if (state.kills.has('STRATEGY_KILL')) return 'STRATEGY_KILL';
  if (state.kills.has('RESEARCH_INTEGRITY_KILL')) return 'RESEARCH_INTEGRITY_KILL';
  if (state.kills.has('DATA_KILL') && (target.dataDependencies ?? []).length > 0) return 'DATA_KILL';
  if (state.kills.has('MODEL_KILL')) return 'MODEL_KILL';
  return undefined;
}

/**
 * Safety authority. State mutation occurs outside the barrier and outside the
 * remote executor. The coordinator consumes a nonce before handing work to the
 * executor, establishing the local commit boundary. The nonce source is local
 * to this scaffold and is not a venue idempotency guarantee.
 */
export class MutationCoordinator {
  private state: VersionedSafetyState;
  private readonly consumedNonces = new Set<string>();
  private readonly barrier: ExecutionBarrier;
  private readonly inFlight = new Map<string, string>();
  private mutationSlotHeld = false;
  private nonceCounter = 0;

  constructor(initialState: VersionedSafetyState, barrier: ExecutionBarrier = new NoOpBarrier()) {
    this.state = initialState;
    this.barrier = barrier;
  }

  get currentState(): VersionedSafetyState {
    return this.state;
  }

  get isSlotFree(): boolean {
    return !this.mutationSlotHeld;
  }

  get hasPendingMutation(): boolean {
    return this.inFlight.size > 0;
  }

  hasPendingMutationFor(instrumentId: string): boolean {
    for (const pendingInstrument of this.inFlight.values()) {
      if (pendingInstrument === instrumentId) return true;
    }
    return false;
  }

  activateKill(kill: KillType): void {
    const kills = new Set(this.state.kills);
    kills.add(kill);
    this.state = { ...this.state, kills, killStateVersion: this.state.killStateVersion + 1 };
  }

  bumpDependencyGraph(): void {
    this.state = { ...this.state, dependencyGraphVersion: this.state.dependencyGraphVersion + 1 };
  }

  authorize(target: MutationScope, now = Date.now()): AuthorizationSnapshot | null {
    if (applicableKill(this.state, target)) return null;
    return {
      target,
      killStateVersion: this.state.killStateVersion,
      dependencyGraphVersion: this.state.dependencyGraphVersion,
      riskAuthorizationVersion: this.state.riskAuthorizationVersion,
      executionPolicyVersion: this.state.executionPolicyVersion,
      nonce: `hq-${++this.nonceCounter}-${now}`,
      expiresAt: now + 5_000,
    };
  }

  async authorizeWithBarrier(target: MutationScope, now = Date.now()): Promise<AuthorizationSnapshot | null> {
    await this.barrier.await('BEFORE_AUTHORIZATION');
    const snapshot = this.authorize(target, now);
    if (snapshot) await this.barrier.await('AFTER_SNAPSHOT');
    return snapshot;
  }

  private validate(snapshot: AuthorizationSnapshot, now: number): DenialReason | undefined {
    if (this.consumedNonces.has(snapshot.nonce)) return 'SNAPSHOT_REPLAY';
    if (snapshot.expiresAt <= now) return 'EXPIRED_AUTHORIZATION';
    if (
      snapshot.killStateVersion !== this.state.killStateVersion ||
      snapshot.dependencyGraphVersion !== this.state.dependencyGraphVersion ||
      snapshot.riskAuthorizationVersion !== this.state.riskAuthorizationVersion ||
      snapshot.executionPolicyVersion !== this.state.executionPolicyVersion
    ) return 'STALE_AUTHORIZATION';
    if (applicableKill(this.state, snapshot.target)) return 'APPLICABLE_KILL_ACTIVE';
    return undefined;
  }

  /**
   * Final revalidation is repeated immediately before nonce consumption. The
   * nonce-consumption step is synchronous and marks the local commit boundary.
   * Once the executor is invoked, a later kill cannot retroactively claim that
   * no remote request was handed off.
   */
  async commitMutation(snapshot: AuthorizationSnapshot, executor: MutationExecutor, now = Date.now()): Promise<MutationResult> {
    await this.barrier.await('BEFORE_FINAL_REVALIDATION');
    const denial = this.validate(snapshot, now);
    if (denial) return { status: 'DENIED', reason: denial === 'APPLICABLE_KILL_ACTIVE' ? 'STALE_AUTHORIZATION' : denial };
    await this.barrier.await('AFTER_FINAL_REVALIDATION');
    const postBarrierDenial = this.validate(snapshot, now);
    if (postBarrierDenial) return { status: 'DENIED', reason: postBarrierDenial === 'APPLICABLE_KILL_ACTIVE' ? 'STALE_AUTHORIZATION' : postBarrierDenial };

    if (this.mutationSlotHeld || this.hasPendingMutationFor(snapshot.target.instrumentId)) {
      return { status: 'DENIED', reason: 'STALE_AUTHORIZATION' };
    }
    this.mutationSlotHeld = true;
    this.consumedNonces.add(snapshot.nonce);
    this.inFlight.set(snapshot.nonce, snapshot.target.instrumentId); // commit boundary crossed

    try {
      const remote = await executor.submit(snapshot);
      if (remote.status === 'CONFIRMED') {
        this.inFlight.delete(snapshot.nonce);
        return { status: 'SUBMITTED_CONFIRMED', nonce: snapshot.nonce, remoteId: remote.remoteId };
      }
      await this.barrier.await('AFTER_REMOTE_SUBMISSION');
      return { status: 'IN_FLIGHT', nonce: snapshot.nonce };
    } finally {
      this.mutationSlotHeld = false;
    }
  }
}
