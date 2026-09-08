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
export * from './research/dsr.js';
export * from './research/psr.js';
export * from './research/search-diagnostics.js';
export * from './research/campaign-ledger.js';
export * from './research/campaign.js';
export * from './research/controlled-holdout.js';
export * from './research/promotion-evidence.js';
export * from './research/evidence-engine.js';
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

export * from './research/timeseries.js';
export * from './research/walk-forward.js';
export * from './research/overfitting.js';
export * from './research/regimes.js';
export * from './research/features.js';
export * from './research/cost-model.js';
export * from './research/backtest.js';
export * from './research/research-runner.js';
export * from './execution/simulator.js';
export * from './execution/order-lifecycle.js';
export * from './execution/order-reconciliation.js';

export * from './execution/order-lifecycle-journal.js';
export * from './execution/order-book.js';
export * from './execution/order-management.js';
export * from './execution/resting-order-book.js';
export * from './execution/latency-model.js';
export * from './execution/impact-model.js';
export * from './execution/shadow-execution.js';
