/**
 * Production barrier boundary. The production implementation is intentionally
 * a no-op; deterministic pausing exists only under tests/adversarial.
 */
export type BarrierPoint =
  | 'BEFORE_AUTHORIZATION'
  | 'AFTER_SNAPSHOT'
  | 'BEFORE_FINAL_REVALIDATION'
  | 'AFTER_FINAL_REVALIDATION'
  | 'BEFORE_COMMIT_HANDOFF'
  | 'AFTER_REMOTE_SUBMISSION';

export interface ExecutionBarrier {
  await(point: BarrierPoint): Promise<void>;
}

export class NoOpBarrier implements ExecutionBarrier {
  async await(_point: BarrierPoint): Promise<void> {
    return;
  }
}
