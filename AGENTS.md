# HYPER-QUANT Agent Operating Manual

This repository is a review-stage, non-live quantitative research and safety platform. Any AI agent, automation, or model must behave as a constrained operator, not as a production trading authority.

## 1. Mission and guardrails

- The canonical status is `REVIEW_REQUIRED` and the current specification is `v2.9`.
- No agent may directly submit, adjust, resize, cancel, or authorize live orders.
- No agent may directly control production signing, exchange credentials, or a live mutation gateway.
- Research and execution planes remain separate. Upper-plane research output is advisory only.
- A promotion or release decision must be evidence-backed and traceable to the specification and review gates.
- The repository must never silently weaken risk, safety, or audit requirements.

## 2. Required reading order

Before changing code or documentation, an agent must read, in this order:

1. `README.md`
2. `docs/productization-master-plan.md`
3. `docs/agent-status.md`
4. `SECURITY.md`
5. `CONTRIBUTING.md`
6. `docs/implementation-progress.md`
7. `spec/versions/v2.9/HYPER-QUANT_MASTER_SPEC_v2.9.md`
8. `docs/agent-runbook.md`

If a task directly touches safety/execution or research governance, also read the relevant section in the specification and the matching review artifact.

## 3. Non-negotiable rules

- Never invent a production path that bypasses the review gate.
- Never classify a failed or ambiguous result as a success.
- Never overwrite an approved master or rewrite historical spec identity.
- Never hide failed variants or raw results from the ledger.
- Never assume a backtest equals a live execution result.
- Treat `PAPER_ONLY` components and virtual balances as simulations, not as a
  promotion, capital decision, or live execution capability.
- Never write secrets, credentials, API keys, seed phrases, wallets, or production exports into the repo.
- If the task would cross live capital, live order submission, signer access, or credential handling, stop and ask for human approval.

## 4. Agent workflow

Every task must follow this loop:

1. State the objective and context.
2. Confirm the relevant repository status, branch, and open blockers.
3. Read only the minimum files needed for the root cause.
4. Plan the fix or change in one short paragraph.
5. Implement the change with no unrelated edits.
6. Validate using the smallest existing command that checks the changed behavior.
7. Update any directly relevant documentation.
8. Leave a clear handoff: status, next action, blocker, validation command, and files touched.

The product sequence is fixed in `docs/productization-master-plan.md`. Continue
the first eligible unchecked status item; do not restart product planning unless
the plan's owner, acceptance criteria, or safety boundary must change.

## 5. Handoff format

Every agent must leave the repository in an actionable state. Use this structure when handing off:

- Objective
- Current status
- What is complete
- What remains
- Blockers or risk
- Validation run
- Next recommended action
- Files changed

This information should also be captured in `docs/agent-status.md` when the work is paused or resumed.

## 6. Validation standard

Before claiming completion, run the repository's existing checks that are relevant to the changed scope:

- `npm run check`
- `npm test`
- any targeted script if the task is narrow and a relevant test exists

Do not claim “done” without validation output.

## 7. Approval boundaries

The repo is explicitly a review-stage implementation. The current branch is not a production deployment branch and must not be treated as one.

- Research proposals remain non-live.
- Execution safety contracts must be enforced even under deterministic test barriers.
- A human must authorize production or live-capital changes outside the reviewed scaffold.

## 8. Operational default

When no explicit instruction is present, the default behavior is:

- follow the specification,
- preserve safety invariants,
- minimize scope,
- keep evidence and traceability,
- leave a resumable state for the next agent.

## 9. When to stop and ask

Stop and ask the user for direction if:

- live exchange or signer access is involved,
- a production risk or kill-switch policy needs reinterpretation,
- a specification change is proposed,
- a task modifies security boundaries or capital-allocation policy,
- a release or approval decision is being requested.

## 10. Repository-specific commands

Use the project-provided checks before concluding work:

- `npm run check`
- `npm test`
- `node scripts/agent-status.mjs`

This repo is intentionally conservative: evidence first, no live activation by code or agent, and traceable review before promotion.
