import type { BarrierPoint, ExecutionBarrier } from '../../src/execution/barrier.js';

/** Test-only: pause/release only. It cannot mutate safety state or authorize work. */
export class DeterministicBarrier implements ExecutionBarrier {
  private readonly paused = new Set<BarrierPoint>();
  private readonly waiters = new Map<BarrierPoint, Array<() => void>>();

  pause(point: BarrierPoint): void {
    this.paused.add(point);
  }

  release(point: BarrierPoint): void {
    this.paused.delete(point);
    const waiters = this.waiters.get(point) ?? [];
    this.waiters.delete(point);
    for (const resolve of waiters) resolve();
  }

  isPaused(point: BarrierPoint): boolean {
    return this.paused.has(point);
  }

  async await(point: BarrierPoint): Promise<void> {
    if (!this.paused.has(point)) return;
    await new Promise<void>((resolve) => {
      const waiters = this.waiters.get(point) ?? [];
      waiters.push(resolve);
      this.waiters.set(point, waiters);
    });
  }
}
