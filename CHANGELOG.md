# Changelog

## Unreleased — v2.9 review candidate (2026-09-08)

- Added v2.9 as a hardening review candidate while preserving v2.8, v2.7, and v2.6 as prior review artifacts.
- Hardened the non-live execution safety kernel with scope-aware kills, authorization-hash validation, fresh-time expiry checks, explicit risk/dependency/policy evaluators, canonical intent transitions, durable intent journal primitives, bounded reconciliation, and cross-platform test execution.
- Added adversarial tests for scoped kill applicability, expiry races, snapshot tampering, durable intent recovery, and bounded reconciliation. Validation remains `REVIEW_REQUIRED`; no live venue or signing capability is introduced.
- Added canonical execution intent lifecycle, versioned authorization snapshots, explicit commit-boundary semantics, and `IN_FLIGHT` reconciliation behavior.
- Added artifact/dependency/build identity binding and fail-closed research-integrity rules.
- Added program/global/family/lineage holdout-budget controls.
- Replaced total-order kill assumptions with scope-aware, monotonic kill authorization.
- Added mechanically bounded capital promotion policy and explicit aggregate exposure dimensions.
- Added deterministic chaos-contract and test/production capability-parity release gates.
- Implemented a non-live TypeScript mutation coordinator scaffold and deterministic TOCTOU tests; no venue adapter or signing capability is present.
- Added executable research-integrity, statistical, holdout-ledger, aggregate-exposure, promotion-policy, chaos-registry, and capability-parity reference controls with adversarial tests.
- Added controlled post-selection holdout boundary and promotion-evidence binding; holdout evaluation requires frozen campaign selection, exact evidence identity, pre-compute reservation, opaque summaries, and a PASS result for promotion evidence.

## v2.6 — Review candidate — 2026-09-06

- Remediated v2.5 adversarial findings.
- Enforced research-trial registration as a prerequisite for empirical compute.
- Added strategy-family multiple-testing controls.
- Replaced undefined normative OpportunityScore weighting with a typed opportunity representation.
- Added payoff-ratio uncertainty stress to Kelly sizing.
- Added persistent repeated-loss escalation.
- Versioned venue execution assumptions explicitly.
- Expanded upper-plane chaos scenarios.
- Corrected review-matrix state integrity logic and section numbering.
- Reframed the system as a disciplined individual quantitative research program with firm-grade safety rather than an assumed institutional edge.

Status: `REVIEW_REQUIRED`

## Unreleased — v2.9 research vertical slice

- Added deterministic, time-aligned feature engine with finite lookback enforcement.
- Added hard purged/embargoed time-series split primitive.
- Added explicit fee/slippage cost model.
- Added deterministic non-live baseline backtest with execution latency and result hashing.
- Added adversarial tests for timestamp ordering, purge/embargo violations, cost sensitivity, determinism, and delayed execution.
