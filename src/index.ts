/**
 * HYPER-QUANT implementation entrypoint.
 *
 * v2.7 is a review candidate. Safety-kernel scaffolding is implemented only
 * for deterministic testing; no venue adapter or signing capability exists.
 */
export const HYPER_QUANT_SPEC_STATUS = 'REVIEW_REQUIRED' as const;
export const HYPER_QUANT_SPEC_VERSION = '2.7' as const;

export type { ExecutionBarrier, BarrierPoint } from './execution/barrier.js';
export * from './execution/mutation-coordinator.js';
