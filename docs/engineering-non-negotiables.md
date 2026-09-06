# Engineering Non-Negotiables

This file is the minimum safety contract for anyone implementing HYPER-QUANT.

## Before writing execution code

1. Treat `spec/versions/v2.6/HYPER-QUANT_MASTER_SPEC_v2.6.md` as a **review candidate**, not an approved production authority.
2. Do not move a candidate into `spec/master/` unless the review closure protocol explicitly permits promotion.
3. Do not connect exchange credentials, production wallets, signing keys, or live order endpoints to the current scaffold.
4. Do not infer that a local process is flat or safe merely because local state says so. Reconcile authoritative venue state.
5. Do not let the AI/research plane acquire signing authority or a direct production-order path.
6. Do not add a new strategy, feature family, model family, execution policy, label, venue, or data transformation without research-trial registration and multiplicity accounting where applicable.
7. Do not promote a result solely because PnL, Sharpe, hit rate, or a composite opportunity score looks attractive.
8. Do not silently change risk limits, kill-switch behavior, venue assumptions, or deployment gates in implementation code. Such changes require a specification change and review record.
9. Do not store secrets in Git, fixtures, notebooks, datasets, logs, crash dumps, CI artifacts, or examples.
10. Unknown exchange outcomes are a reconciliation problem, not a permission to retry blindly.
11. Safety-triggered shutdowns must not auto-resume.
12. Small-capital deployment must remain smallest-viable-scope first. Capital growth is earned by evidence, not by target returns.

## Definition of done for implementation work

A change is not considered complete until:

- the normative requirement it implements is identified;
- tests cover the failure path, not only the happy path;
- state transitions are explicit and deterministic;
- observability is sufficient to reconstruct what happened without exposing secrets;
- live-execution implications are reviewed;
- the CI integrity checks remain green;
- the change does not bypass the research ledger or review gates.

## Default behavior when uncertain

`NO_TRADE`, `BLOCKED`, `REVIEW_REQUIRED`, or `INCONCLUSIVE` are preferred over guessing.
