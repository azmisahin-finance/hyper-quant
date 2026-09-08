# Copilot instructions

This repository is a review-stage quantitative research and execution-safety project. Treat it as evidence-driven, non-live infrastructure unless a human explicitly approves otherwise.

## Core operating rules

- Respect the v2.9 review status: `REVIEW_REQUIRED`.
- Never approve or enable live trading, live order mutation, signer access, or real capital movement.
- Keep research and execution safety layers separated.
- Preserve the current specification, auditability, and traceability requirements.
- Avoid unrelated changes; do narrow, verifiable work.
- Before claiming completion, run the relevant project validation command.

## Required workflow

1. Read the relevant project docs and the current status before writing code.
2. Keep changes small and evidence-driven.
3. Validate with the smallest existing command that covers the change.
4. Update docs only when the change changes behavior, risk, or operating expectations.
5. Leave a resumable handoff with status, blockers, and next steps.

## Safety and governance rules

- No secrets, credentials, API keys, seeds, or live exchange artifacts in the repo.
- No direct agent control over signers, exchange credentials, or live execution.
- No silent weakening of kill, risk, dependency, or promotion gates.
- Any change that affects safety, execution, or research governance should be reviewed as a change to the current review candidate.

## Repo commands

- `npm run check`
- `npm test`
- `node scripts/agent-status.mjs`

If a task touches live-capital, signing, production deployment, or release approval, stop and ask the user.
