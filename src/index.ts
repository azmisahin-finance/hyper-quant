/**
 * HYPER-QUANT implementation entrypoint.
 *
 * v2.9 is a review candidate. The repository contains a hardened safety kernel,
 * a read-oriented BtcTurk spot adapter, immutable event capture, and deterministic replay.
 * Live mutation still requires an external mutation gateway and signer boundary.
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

export * from './venues/types.js';
export * from './venues/btcturk-http.js';
export * from './venues/btcturk-spot-adapter.js';
export * from './data/immutable-event-log.js';
export * from './data/market-data-recorder.js';
export * from './data/btcturk-ws.js';
export * from './replay/replay-engine.js';
