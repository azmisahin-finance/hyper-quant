import assert from 'node:assert/strict';
import test from 'node:test';
import { DeterministicBarrier } from './deterministic-barrier.js';
import { MutationCoordinator, type MutationExecutor } from '../../src/execution/mutation-coordinator.js';

const target = { venueId: 'V1', strategyId: 'S1', instrumentId: 'BTC/TRY', dataDependencies: ['feed-A'] };
const initialState = {
  killStateVersion: 0,
  dependencyGraphVersion: 1,
  riskAuthorizationVersion: 1,
  executionPolicyVersion: 1,
  kills: new Set<'SYSTEM_KILL' | 'RESEARCH_INTEGRITY_KILL' | 'VENUE_KILL' | 'DATA_KILL' | 'MODEL_KILL' | 'STRATEGY_KILL'>(),
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
  const coordinator = new MutationCoordinator(initialState, barrier);
  const executor = new TestMutationExecutor();
  const snapshot = coordinator.authorize(target);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  const pending = coordinator.commitMutation(snapshot, executor);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  coordinator.activateKill('VENUE_KILL');
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
  const coordinator = new MutationCoordinator(initialState, barrier);
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

test('GAP-08: snapshot replay is denied and remains non-replayable', async () => {
  const coordinator = new MutationCoordinator(initialState);
  const executor = new TestMutationExecutor();
  const snapshot = coordinator.authorize(target);
  assert.ok(snapshot);
  if (!snapshot) throw new Error('snapshot creation failed');

  const first = await coordinator.commitMutation(snapshot, {
    submit: async () => ({ status: 'CONFIRMED' as const, remoteId: 'remote-1' }),
  });
  assert.equal(first.status, 'SUBMITTED_CONFIRMED');

  const replay = await coordinator.commitMutation(snapshot, executor);
  assert.deepEqual(replay, { status: 'DENIED', reason: 'SNAPSHOT_REPLAY' });
  assert.equal(executor.remoteMutationCount, 0);
});

test('GAP-08: kill after commit boundary produces IN_FLIGHT, not false zero-mutation', async () => {
  const coordinator = new MutationCoordinator(initialState);
  const executor = new TestMutationExecutor();
  executor.beforeRemoteSubmission = () => coordinator.activateKill('VENUE_KILL');
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
