import type { ExecutionBarrier } from './barrier.js';
import { NoOpBarrier } from './barrier.js';
import { authorizationHash, type DependencyCompatibilityEvaluator, type ExecutionPolicyEvaluator, type HardRiskEvaluator } from './safety-authority.js';

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
  modelIds?: string[];
  researchProgramIds?: string[];
};

export type KillApplicability =
  | { kind: 'SYSTEM' }
  | { kind: 'VENUE'; venueId: string }
  | { kind: 'STRATEGY'; strategyId: string; venueId: string }
  | { kind: 'DATA'; dependencyIds: string[] }
  | { kind: 'MODEL'; modelIds: string[] }
  | { kind: 'RESEARCH'; researchProgramIds: string[] };

export type KillActivation = {
  id: string;
  type: KillType;
  applicability: KillApplicability;
};

export type VersionedSafetyState = {
  killStateVersion: number;
  dependencyGraphVersion: number;
  riskAuthorizationVersion: number;
  executionPolicyVersion: number;
  kills: ReadonlyMap<string, KillActivation>;
};

export type AuthorizationSnapshot = {
  target: MutationScope;
  killStateVersion: number;
  dependencyGraphVersion: number;
  riskAuthorizationVersion: number;
  executionPolicyVersion: number;
  authorizationHash: string;
  nonce: string;
  expiresAt: number;
};

export type DenialReason =
  | 'STALE_AUTHORIZATION'
  | 'SNAPSHOT_REPLAY'
  | 'EXPIRED_AUTHORIZATION'
  | 'APPLICABLE_KILL_ACTIVE'
  | 'HARD_RISK_FAILED'
  | 'DEPENDENCY_INCOMPATIBLE'
  | 'EXECUTION_POLICY_FAILED';

export type MutationResult =
  | { status: 'DENIED'; reason: DenialReason }
  | { status: 'IN_FLIGHT'; nonce: string }
  | { status: 'SUBMITTED_CONFIRMED'; nonce: string; remoteId: string };

export interface MutationExecutor {
  submit(snapshot: AuthorizationSnapshot): Promise<{ status: 'UNKNOWN' } | { status: 'CONFIRMED'; remoteId: string }>;
}

type SafetyEvaluators = {
  hardRisk: HardRiskEvaluator;
  dependencyCompatible: DependencyCompatibilityEvaluator;
  executionPolicyCompatible: ExecutionPolicyEvaluator;
};

function intersects(left: readonly string[] | undefined, right: readonly string[]): boolean {
  if (!left || left.length === 0) return false;
  const set = new Set(left);
  return right.some((item) => set.has(item));
}

function applies(kill: KillActivation, target: MutationScope): boolean {
  switch (kill.applicability.kind) {
    case 'SYSTEM':
      return kill.type === 'SYSTEM_KILL';
    case 'VENUE':
      return target.venueId === kill.applicability.venueId;
    case 'STRATEGY':
      return target.venueId === kill.applicability.venueId && target.strategyId === kill.applicability.strategyId;
    case 'DATA':
      return intersects(target.dataDependencies, kill.applicability.dependencyIds);
    case 'MODEL':
      return intersects(target.modelIds, kill.applicability.modelIds);
    case 'RESEARCH':
      return intersects(target.researchProgramIds, kill.applicability.researchProgramIds);
    default:
      return false;
  }
}

function assertKillActivation(kill: KillActivation): void {
  const expected = {
    SYSTEM_KILL: 'SYSTEM',
    VENUE_KILL: 'VENUE',
    STRATEGY_KILL: 'STRATEGY',
    DATA_KILL: 'DATA',
    MODEL_KILL: 'MODEL',
    RESEARCH_INTEGRITY_KILL: 'RESEARCH',
  }[kill.type];
  if (expected !== kill.applicability.kind) {
    throw new Error(`KILL_SCOPE_TYPE_MISMATCH:${kill.type}:${kill.applicability.kind}`);
  }
}

function applicableKill(state: VersionedSafetyState, target: MutationScope): KillActivation | undefined {
  for (const kill of state.kills.values()) {
    if (applies(kill, target)) return kill;
  }
  return undefined;
}

export type MutationCoordinatorOptions = {
  barrier?: ExecutionBarrier;
  evaluators: SafetyEvaluators;
  now?: () => number;
};

/**
 * Deterministic local safety authority. It intentionally has no venue adapter
 * or signing capability. Every authorization uses scope-aware kills, versioned
 * state, hard-risk/policy evaluators, a hashed snapshot, and a fresh clock
 * reading at every validation point.
 */
export class MutationCoordinator {
  private state: VersionedSafetyState;
  private readonly consumedNonces = new Set<string>();
  private readonly barrier: ExecutionBarrier;
  private readonly evaluators: SafetyEvaluators;
  private readonly now: () => number;
  private readonly inFlight = new Map<string, string>();
  private mutationSlotHeld = false;
  private nonceCounter = 0;

  constructor(initialState: VersionedSafetyState, options: MutationCoordinatorOptions) {
    this.state = initialState;
    this.barrier = options.barrier ?? new NoOpBarrier();
    this.evaluators = options.evaluators;
    this.now = options.now ?? Date.now;
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

  activateKill(kill: KillActivation): void {
    assertKillActivation(kill);
    const kills = new Map(this.state.kills);
    kills.set(kill.id, kill);
    this.state = { ...this.state, kills, killStateVersion: this.state.killStateVersion + 1 };
  }

  clearKill(killId: string): void {
    const kills = new Map(this.state.kills);
    if (!kills.delete(killId)) return;
    this.state = { ...this.state, kills, killStateVersion: this.state.killStateVersion + 1 };
  }

  bumpDependencyGraph(): void {
    this.state = { ...this.state, dependencyGraphVersion: this.state.dependencyGraphVersion + 1 };
  }

  bumpRiskAuthorization(): void {
    this.state = { ...this.state, riskAuthorizationVersion: this.state.riskAuthorizationVersion + 1 };
  }

  bumpExecutionPolicy(): void {
    this.state = { ...this.state, executionPolicyVersion: this.state.executionPolicyVersion + 1 };
  }

  authorize(target: MutationScope, now = this.now()): AuthorizationSnapshot | null {
    if (applicableKill(this.state, target)) return null;
    if (!this.evaluators.hardRisk(target)) return null;
    if (!this.evaluators.dependencyCompatible(target, this.state)) return null;
    if (!this.evaluators.executionPolicyCompatible(target, this.state)) return null;

    const nonce = `hq-${++this.nonceCounter}-${now}`;
    const expiresAt = now + 5_000;
    const unsigned = {
      target: {
        ...target,
        dataDependencies: [...(target.dataDependencies ?? [])],
        modelIds: [...(target.modelIds ?? [])],
        researchProgramIds: [...(target.researchProgramIds ?? [])],
      },
      killStateVersion: this.state.killStateVersion,
      dependencyGraphVersion: this.state.dependencyGraphVersion,
      riskAuthorizationVersion: this.state.riskAuthorizationVersion,
      executionPolicyVersion: this.state.executionPolicyVersion,
      expiresAt,
      nonce,
    };
    return { ...unsigned, authorizationHash: authorizationHash(unsigned) };
  }

  async authorizeWithBarrier(target: MutationScope, now = this.now()): Promise<AuthorizationSnapshot | null> {
    await this.barrier.await('BEFORE_AUTHORIZATION');
    const snapshot = this.authorize(target, now);
    if (snapshot) await this.barrier.await('AFTER_SNAPSHOT');
    return snapshot;
  }

  private validate(snapshot: AuthorizationSnapshot): DenialReason | undefined {
    const currentNow = this.now();
    if (this.consumedNonces.has(snapshot.nonce)) return 'SNAPSHOT_REPLAY';
    if (snapshot.expiresAt <= currentNow) return 'EXPIRED_AUTHORIZATION';
    if (snapshot.authorizationHash !== authorizationHash({
      target: snapshot.target,
      killStateVersion: snapshot.killStateVersion,
      dependencyGraphVersion: snapshot.dependencyGraphVersion,
      riskAuthorizationVersion: snapshot.riskAuthorizationVersion,
      executionPolicyVersion: snapshot.executionPolicyVersion,
      expiresAt: snapshot.expiresAt,
      nonce: snapshot.nonce,
    })) return 'STALE_AUTHORIZATION';

    if (
      snapshot.killStateVersion !== this.state.killStateVersion ||
      snapshot.dependencyGraphVersion !== this.state.dependencyGraphVersion ||
      snapshot.riskAuthorizationVersion !== this.state.riskAuthorizationVersion ||
      snapshot.executionPolicyVersion !== this.state.executionPolicyVersion
    ) return 'STALE_AUTHORIZATION';

    if (applicableKill(this.state, snapshot.target)) return 'APPLICABLE_KILL_ACTIVE';
    if (!this.evaluators.hardRisk(snapshot.target)) return 'HARD_RISK_FAILED';
    if (!this.evaluators.dependencyCompatible(snapshot.target, this.state)) return 'DEPENDENCY_INCOMPATIBLE';
    if (!this.evaluators.executionPolicyCompatible(snapshot.target, this.state)) return 'EXECUTION_POLICY_FAILED';
    return undefined;
  }

  async commitMutation(snapshot: AuthorizationSnapshot, executor: MutationExecutor): Promise<MutationResult> {
    await this.barrier.await('BEFORE_FINAL_REVALIDATION');
    const firstDenial = this.validate(snapshot);
    if (firstDenial) return { status: 'DENIED', reason: firstDenial };

    await this.barrier.await('AFTER_FINAL_REVALIDATION');
    const postBarrierDenial = this.validate(snapshot);
    if (postBarrierDenial) return { status: 'DENIED', reason: postBarrierDenial };

    await this.barrier.await('BEFORE_COMMIT_HANDOFF');
    const handoffDenial = this.validate(snapshot);
    if (handoffDenial) return { status: 'DENIED', reason: handoffDenial };

    // This synchronous block is the local commit boundary. No await exists
    // between final validation, slot acquisition, nonce consumption, and
    // executor handoff eligibility.
    if (this.mutationSlotHeld || this.hasPendingMutationFor(snapshot.target.instrumentId)) {
      return { status: 'DENIED', reason: 'STALE_AUTHORIZATION' };
    }

    this.mutationSlotHeld = true;
    this.consumedNonces.add(snapshot.nonce);
    this.inFlight.set(snapshot.nonce, snapshot.target.instrumentId);

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
