# Tests

The repository distinguishes production safety logic from test-only control surfaces. Test barriers may pause and release execution but have no authority to mutate kill state, risk policy, authorization, or remote state.

Current adversarial coverage includes:

- kill-before-final-revalidation TOCTOU denial;
- dependency-graph version race denial;
- single-use authorization snapshot replay denial;
- kill-after-commit-boundary `IN_FLIGHT` classification without false zero-mutation claims.

The test-only `DeterministicBarrier` and mutation executor live under `tests/adversarial/` and must not enter the production artifact. The production source tree uses `NoOpBarrier` plus the same safety authorization/coordinator logic.

The broader suite shall eventually include deterministic unit tests, property/invariant tests, replay/backtest reproducibility, venue-adapter contracts, partial-fill and reconciliation tests, kill-switch tests, repeated-loss escalation, research-trial registration, AI isolation, upper-plane chaos, statistical validation, and canary safety tests.

No production promotion should rely solely on happy-path tests.
