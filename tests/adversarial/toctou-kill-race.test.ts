import assert from 'node:assert/strict';
import test from 'node:test';
import { DeterministicBarrier } from './deterministic-barrier.js';
import { MutationCoordinator, type MutationExecutor, type MutationScope, type VersionedSafetyState } from '../../src/execution/mutation-coordinator.js';

const target: MutationScope = {
  venueId: 'V1',
  strategyId: 'S1',
  instrumentId: 'BTC/TRY',
  dataDependencies: ['feed-A'],
  modelIds: ['model-1'],
  researchProgramIds: ['research-1'],
};

function initialState(): VersionedSafetyState {
  return {
    killStateVersion: 0,
    dependencyGraphVersion: 1,
    riskAuthorizationVersion: 1,
    executionPolicyVersion: 1,
    kills: new Map(),
  };
}

const safeEvaluators = {
  hardRisk: () => true,
  dependencyCompatible: () => true,
  executionPolicyCompatible: () => true,
};

class TestMutationExecutor implements MutationExecutor {
  public remoteMutationCount = 0;
  public beforeRemoteSubmission?: () => void;

  async submit() {
    this.beforeRemoteSubmission?.();
    this.remoteMutationCount += 1;
    return { status: 'UNKNOWN' as const };
  }
}

test('GAP-08: kill before final revalidation denies and makes zero remote mutations', async () => {
  const barrier = new DeterministicBarrier();
  barrier.pause('BEFORE_FINAL_REVALIDATION');
  const coordinator = new MutationCoordinator(initialState(), { barrier, evaluators: safeEvaluators });
  const executor = new TestMutationExecutor();
  const snapshot = coordinator.authorize(target);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  const pending = coordinator.commitMutation(snapshot, executor);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  coordinator.activateKill({ id: 'kill-v1', type: 'VENUE_KILL', applicability: { kind: 'VENUE', venueId: 'V1' } });
  barrier.release('BEFORE_FINAL_REVALIDATION');

  const result = await pending;
  assert.deepEqual(result, { status: 'DENIED', reason: 'STALE_AUTHORIZATION' });
  assert.equal(executor.remoteMutationCount, 0);
  assert.equal(coordinator.isSlotFree, true);
  assert.equal(coordinator.hasPendingMutation, false);
});

test('GAP-08: dependency graph race invalidates the snapshot before commit boundary', async () => {
  const barrier = new DeterministicBarrier();
  barrier.pause('BEFORE_FINAL_REVALIDATION');
  const coordinator = new MutationCoordinator(initialState(), { barrier, evaluators: safeEvaluators });
  const executor = new TestMutationExecutor();
  const snapshot = coordinator.authorize(target);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  const pending = coordinator.commitMutation(snapshot, executor);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  coordinator.bumpDependencyGraph();
  barrier.release('BEFORE_FINAL_REVALIDATION');

  const result = await pending;
  assert.deepEqual(result, { status: 'DENIED', reason: 'STALE_AUTHORIZATION' });
  assert.equal(executor.remoteMutationCount, 0);
});

test('GAP-08: simultaneous scoped kills apply only to matching targets', async () => {
  const state = initialState();
  const coordinator = new MutationCoordinator(state, { evaluators: safeEvaluators });
  coordinator.activateKill({ id: 'venue-v1', type: 'VENUE_KILL', applicability: { kind: 'VENUE', venueId: 'V1' } });
  coordinator.activateKill({ id: 'data-a', type: 'DATA_KILL', applicability: { kind: 'DATA', dependencyIds: ['feed-A'] } });
  coordinator.activateKill({ id: 'strategy-s1', type: 'STRATEGY_KILL', applicability: { kind: 'STRATEGY', strategyId: 'S1', venueId: 'V1' } });

  assert.equal(coordinator.authorize(target), null);
  assert.equal(coordinator.authorize({ ...target, strategyId: 'S2' }), null);
  assert.equal(coordinator.authorize({ ...target, strategyId: 'S3', venueId: 'V1', dataDependencies: ['feed-B'] }), null);
  assert.equal(coordinator.authorize({ ...target, venueId: 'V2', strategyId: 'S4', dataDependencies: ['feed-A'] }), null);
  assert.ok(coordinator.authorize({ ...target, venueId: 'V2', strategyId: 'S5', dataDependencies: ['feed-B'], modelIds: ['model-9'], researchProgramIds: ['research-9'] }));
});

test('GAP-08: expiry is checked against fresh time after an adversarial barrier', async () => {
  const barrier = new DeterministicBarrier();
  barrier.pause('BEFORE_COMMIT_HANDOFF');
  let clock = 1_000;
  const coordinator = new MutationCoordinator(initialState(), { barrier, evaluators: safeEvaluators, now: () => clock });
  const executor = new TestMutationExecutor();
  const snapshot = coordinator.authorize(target, clock);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  const pending = coordinator.commitMutation(snapshot, executor);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  clock = 7_000;
  barrier.release('BEFORE_COMMIT_HANDOFF');

  const result = await pending;
  assert.deepEqual(result, { status: 'DENIED', reason: 'EXPIRED_AUTHORIZATION' });
  assert.equal(executor.remoteMutationCount, 0);
});

test('GAP-08: snapshot tampering is denied before remote handoff', async () => {
  const coordinator = new MutationCoordinator(initialState(), { evaluators: safeEvaluators });
  const executor = new TestMutationExecutor();
  const snapshot = coordinator.authorize(target);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  const tampered = { ...snapshot, target: { ...snapshot.target, strategyId: 'attacker-strategy' } };
  const result = await coordinator.commitMutation(tampered, executor);
  assert.deepEqual(result, { status: 'DENIED', reason: 'STALE_AUTHORIZATION' });
  assert.equal(executor.remoteMutationCount, 0);
});

test('GAP-08: kill after commit boundary produces IN_FLIGHT, not false zero-mutation', async () => {
  const coordinator = new MutationCoordinator(initialState(), { evaluators: safeEvaluators });
  const executor = new TestMutationExecutor();
  executor.beforeRemoteSubmission = () => coordinator.activateKill({ id: 'kill-v1', type: 'VENUE_KILL', applicability: { kind: 'VENUE', venueId: 'V1' } });
  const snapshot = coordinator.authorize(target);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  const result = await coordinator.commitMutation(snapshot, executor);
  assert.deepEqual(result, { status: 'IN_FLIGHT', nonce: snapshot.nonce });
  assert.equal(executor.remoteMutationCount, 1);
  assert.equal(coordinator.hasPendingMutation, true);
  assert.equal(coordinator.hasPendingMutationFor(target.instrumentId), true);
  assert.equal(coordinator.isSlotFree, true);
});

test('GAP-08: hard risk, dependency, and execution-policy gates fail closed', () => {
  const base = initialState();
  const targetCopy = { ...target };
  const cases = [
    ['HARD_RISK_FAILED', { hardRisk: () => false, dependencyCompatible: () => true, executionPolicyCompatible: () => true }],
    ['DEPENDENCY_INCOMPATIBLE', { hardRisk: () => true, dependencyCompatible: () => false, executionPolicyCompatible: () => true }],
    ['EXECUTION_POLICY_FAILED', { hardRisk: () => true, dependencyCompatible: () => true, executionPolicyCompatible: () => false }],
  ] as const;

  for (const [reason, evaluators] of cases) {
    const coordinator = new MutationCoordinator(base, { evaluators });
    assert.equal(coordinator.authorize(targetCopy), null);
  }
});

test('GAP-08: clearing an applicable kill advances kill version and invalidates an old snapshot', async () => {
  const coordinator = new MutationCoordinator(initialState(), { evaluators: safeEvaluators });
  const snapshot = coordinator.authorize(target);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  coordinator.activateKill({ id: 'kill-v1', type: 'VENUE_KILL', applicability: { kind: 'VENUE', venueId: 'V1' } });
  coordinator.clearKill('kill-v1');
  const executor = new TestMutationExecutor();
  const result = await coordinator.commitMutation(snapshot, executor);
  assert.deepEqual(result, { status: 'DENIED', reason: 'STALE_AUTHORIZATION' });
  assert.equal(executor.remoteMutationCount, 0);
});
