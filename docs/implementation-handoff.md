# Implementation Handoff

## Mission

Build an evidence-driven quantitative research and execution-safety system without assuming that a profitable strategy exists.

The repository is intentionally usable as a starting point for a new engineer, but it is **not** permission to deploy capital.

## Source of authority

Current candidate specification:

`spec/versions/v2.9/HYPER-QUANT_MASTER_SPEC_v2.9.md`

Current status:

`REVIEW_REQUIRED`

No approved production master is present yet.

## First implementation principle

Implement infrastructure and safety boundaries before alpha complexity:

1. deterministic domain types and state machines, including the canonical intent lifecycle and commit boundary,
2. research-trial identity and durable ledger interfaces,
3. market/account data contracts,
4. replay/backtest interfaces with realistic cost modeling,
5. risk and capital-allocation invariants,
6. venue execution profiles,
7. reconciliation and protective-exit machinery, including `IN_FLIGHT` handling,
8. only then strategy logic and live adapters.

## What must not happen in an early implementation

- no live order submission from the current scaffold;
- no private key in source or environment files committed to Git;
- no AI-to-signer connection;
- no automatic production enablement from CI;
- no automatic promotion from backtest to production;
- no retry loop that treats an unknown exchange result as a known failure;
- no local database treated as the authoritative record of live exposure.

## Safe first milestone

A good first milestone is a **read-only / replayable vertical slice** that can ingest normalized events, register a research trial, replay historical data, emit a deterministic decision artifact, and prove that no live-order capability exists.

Only after that milestone and the specification review closure should live execution be considered.

## Review discipline

Every material design change should identify:

- the relevant specification section;
- the changed invariant;
- the failure modes added or removed;
- the test that proves the intended behavior;
- whether the change affects research validity, risk, execution, security, or release gates.

When evidence is insufficient, stop at `REVIEW_REQUIRED` rather than inventing an assumption.


## v2.8 implementation boundary

The current scaffold implements a hardened local deterministic safety contract plus intent/reconciliation primitives. It does not submit orders, sign payloads, connect credentials, or access a production venue. `DeterministicBarrier` and test mutation executors are test-only and remain outside production builds. The durable journal is a repository-level primitive; venue/database/filesystem production proof remains outstanding.

## v2.9 Phase-2/4 implementation boundary

The repository now contains a BtcTurk spot adapter for documented public endpoints and authenticated read endpoints, plus immutable hash-chained event capture and deterministic replay. Live order submission/cancellation is deliberately rejected at the adapter boundary until the canonical MutationCoordinator, an external signer/auth boundary, and an explicit mutation gateway are wired together. No production secret or concrete signer is stored in this repository.
