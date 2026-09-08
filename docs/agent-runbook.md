# HYPER-QUANT Agent Runbook

## Purpose

This runbook defines how any agent, automation, or human operator should understand and execute work in this repository without drifting away from the safety and review boundaries.

## Project status summary

- Spec status: `REVIEW_REQUIRED`
- Spec version: `v2.9`
- Implementation status: non-live research and safety scaffold
- Production live trading: prohibited in this repo
- Required review gate: independent adversarial review before production approval

## Authority model

The repository is intentionally split into:

- upper research plane: hypotheses, features, research, backtests, campaign evidence
- lower safety/execution plane: intent validation, kill state, dependency gates, reconciliation

Any AI agent may help with coding, analysis, and validation only within the reviewed non-live scope. Live trade execution, signer authority, and production deployment remain out of scope.

## Mandatory operating sequence

For every task, do the following in order:

1. Confirm the objective and the affected scope.
2. Read the status, branch, and the minimum relevant files.
3. Identify whether the task affects one of these domains: research, execution safety, venue integration, docs, governance, or release.
4. Apply the narrowest valid fix.
5. Validate with the existing repo checks.
6. Update the handoff state.
7. Stop only after the repo is in a resumable state.

## Role definitions

### Research agent

Handles:

- research experiments
- datasets and replay validation
- backtests and feature logic
- campaign/holdout evidence bookkeeping

Constraints:

- no direct access to live capital
- no hidden data leakage or holdout bypass
- all results must trace to receipts and campaigns

### Safety agent

Handles:

- kill-switch behavior
- dependency validation
- execution intent transitions
- final revalidation and reconciliation logic

Constraints:

- cannot bypass fail-closed logic
- cannot claim zero remote mutation after commit boundary
- must preserve commit-boundary semantics

### Platform agent

Handles:

- repo hygiene
- CI scripts
- build and validation checks
- docs and operational compliance

Constraints:

- no change to live production or production-approval logic without a human decision
- keep commands deterministic and evidence-backed

### Human reviewer / approver

Responsible for:

- review gate decisions
- release approval
- specification change authorization
- live-capital or signer-related decision points

## Decision rules

If a task touches any of the following, it must be treated as a governance task and not just a coding task:

- safety boundary
- execution kill logic
- dependency versioning
- risk policy
- promotion or evidence package
- signing authority
- live exchange or wallet access
- specification version or review status

## Required output at task close

A completed task must include:

- objective summary
- repository status at finish
- validation command(s) used
- result of validation
- any remaining blockers
- the exact next action for the next agent

This should be reflected in `docs/agent-status.md` if the task is paused or resumed.

## Review checklists

### Before merging or marking done

- Specification identity still matches the reviewed version.
- Safety invariants are preserved.
- Tests, type-check, and repo validation pass.
- Documentation reflects the actual state.
- No secrets or live credentials are present.
- The task did not silently weaken the project policy.

### Before claiming a release or production path

- the review matrix is complete,
- the relevant independent review is complete,
- the required evidence is present,
- the production signer and live venue boundary are explicitly externalized,
- the implementation is still non-live in this repository.

## Resume protocol for another agent

When another agent resumes work, it must:

1. Read `docs/agent-status.md`.
2. Confirm branch and task objective.
3. Check the last successful validation output.
4. Verify the remaining blockers.
5. Continue the task without redoing closed work.

## Current operational baseline

The project currently has:

- evidence-driven research framework
- deterministic safety tests
- read-only venue adapter scaffold
- immutable event log and replay system
- no live mutation authorization

Open proof obligations are tracked in `docs/implementation-progress.md` and must remain visible to all agents.
