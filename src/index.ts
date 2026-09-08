/**
 * HYPER-QUANT implementation entrypoint.
 *
 * v2.8 is a review candidate. The repository contains a hardened, non-live
 * safety/reconciliation scaffold; no venue adapter or signing capability exists.
 */
export const HYPER_QUANT_SPEC_STATUS = 'REVIEW_REQUIRED' as const;
export const HYPER_QUANT_SPEC_VERSION = '2.8' as const;

export type { ExecutionBarrier, BarrierPoint } from './execution/barrier.js';
export * from './execution/intent-journal.js';
export * from './execution/intent-state-machine.js';
export * from './execution/mutation-coordinator.js';
export * from './execution/reconciliation.js';
export * from './execution/safety-authority.js';
