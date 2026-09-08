# Agent Status Ledger

This file is the resumable operational state for AI agents and operators. Update it whenever work is paused, resumed, or completed.

## Current project state

- Repository: `azmisahin-finance/hyper-quant`
- Current branch: `azmisahin-research-campaign-integrity`
- Spec version: `v2.9`
- Review status: `REVIEW_REQUIRED`
- Live trading status: `PROHIBITED`
- Agent execution scope: `non-live review and development only`

## Current objective

Harden the non-live research operating system for deterministic statistical
conventions and same-path campaign, trial, and holdout concurrency behavior.

## Completion status

- [x] Review the repository structure and current readiness
- [x] Confirm repo status and validation baseline
- [x] Create repo-level AI instructions (`AGENTS.md`, `.github/copilot-instructions.md`)
- [x] Create the agent runbook and operational boundaries
- [x] Add a deterministic repo status/script for future agents
- [x] Add the multi-perspective specification governance and operating model
- [x] Serialize same-path research ledger writers and persist DSR convention
- [ ] Obtain independent human/adversarial review before any production claim

## Last validated baseline

- `npm run check` — passed
- `npm test` — passed (113 tests, 0 failed)

## Immediate next actions

1. Obtain independent review of the research ledger concurrency and DSR
   convention hardening.
2. Keep this ledger updated whenever work continues.
3. Use `node scripts/agent-status.mjs` as the default status command for the next agent.

## Handoff template

Use the following format when handing work to another agent:

- Objective:
- Current status:
- Complete:
- Remaining:
- Blockers:
- Validation:
- Next action:
- Files touched:

## Notes

- This repository is intentionally conservative: no production signer access, no live order submission, and no implicit approval of capital deployment.
- Any future change that approaches live-capital or signer ownership must be escalated to a human decision-maker.
