# Deployment Gates

Production allocation is staged rather than binary.

The gate sequence is based on reproducibility, realistic costs, out-of-sample evidence, drawdown behavior, operational readiness, execution uncertainty, and risk limits.

Key rules include:

- smallest viable real capital first,
- no assumption that simulated fills equal live fills,
- isolated and venue-appropriate risk controls,
- explicit kill-switch behavior,
- persistent repeated-loss escalation,
- no auto-resume after safety-triggered shutdown,
- capital increases only after pre-defined evidence gates.


## v2.7 execution-race release gates

Before any future venue mutation capability is considered, the execution layer must prove the distinction between pre-handoff denial and post-handoff uncertainty. A kill or dependency-version change before the commit boundary must yield denial with zero remote mutation attempts. A kill after commit boundary must classify the mutation as `IN_FLIGHT` and require exchange reconciliation rather than manufacturing a failure or flat state.

Authorization snapshots are single-use and version-bound. The final revalidation must occur immediately before the commit boundary, and the physical mutation slot remains exclusive. Test-only deterministic barriers may control scheduling but never act as a safety authority.

The production build must pass the test/production capability-parity gate before a release can claim verified safety controls.
