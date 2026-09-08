/**
 * HYPER-QUANT implementation entrypoint.
 *
 * v2.9 is a review candidate. The repository contains a hardened, non-live
 * safety/reconciliation scaffold; no venue adapter or signing capability exists.
 */
export const HYPER_QUANT_SPEC_STATUS = 'REVIEW_REQUIRED' as const;
export const HYPER_QUANT_SPEC_VERSION = '2.9' as const;

export type { ExecutionBarrier, BarrierPoint } from './execution/barrier.js';
export * from './execution/intent-journal.js';
export * from './execution/intent-state-machine.js';
export * from './execution/mutation-coordinator.js';
export * from './execution/reconciliation.js';
export * from './execution/safety-authority.js';
export * from './research/dependency.js';
export * from './research/artifact-identity.js';
export * from './research/holdout-ledger.js';
export * from './research/statistics.js';
export * from './research/trial-ledger.js';
export * from './risk/exposure-engine.js';
export * from './risk/promotion-policy.js';
export * from './release/capability-parity.js';
export * from './release/chaos-contract.js';
