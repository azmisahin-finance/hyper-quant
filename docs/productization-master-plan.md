# HYPER-QUANT Productization Master Plan

**Status:** `REVIEW_REQUIRED` / `NON_LIVE` / `PAPER_ONLY`
**Product decision:** build a usable, evidence-driven paper product while the
research and safety proof obligations continue in parallel.
**Authority:** this is the authoritative execution plan for product sequencing.
It does not override the v2.9 specification, review artifacts, security rules,
or the prohibition on live trading.
**Last updated:** 2026-09-10

## Start here

Every incoming engineer or agent starts with this file, then reads
`AGENTS.md`, `docs/agent-status.md`, `docs/agent-runbook.md`, and the relevant
v2.9 specification section. The current work item is always the first unchecked
item in `docs/agent-status.md`; do not reopen a planning cycle before executing
that item or recording a concrete blocker.

## Product outcome

The first product is a zero-capital, deterministic `BTC/TRY` paper bot:

```text
read-only market data -> deterministic strategy -> signal -> risk decision
-> paper order -> simulated fill -> simulated position/PnL -> hash-addressed
event log -> operator status
```

It is useful only if every stage is inspectable and reproducible. It cannot
send a live order, read a signer, use exchange credentials, move capital, or
turn passing tests into a release decision.

## Fixed operating rules

- `REVIEW_REQUIRED` remains the overall specification status.
- Live trading is `PROHIBITED`; every product increment must preserve that
  boundary with code and tests.
- BtcTurk data may be observed through read-only contracts only. A data feed is
  not execution authority.
- Simulated balances are test artifacts, not capital allocation or financial
  performance claims.
- A candidate may enter a real paper evaluation only after the evidence gates
  in `docs/stakeholder-master-execution-plan.md` are satisfied. Implementing a
  paper component does not satisfy those gates.
- Unknown, stale, missing, inconsistent, or unreviewed state is fail-closed:
  `HOLD`, `NO_TRADE`, `BLOCKED`, `PAUSE`, or `REVIEW_REQUIRED`.

## Product sequence

| Milestone | Outcome | Current state | Exit evidence | Explicitly not granted |
| --- | --- | --- | --- | --- |
| M1 — Paper Bot Vertical Slice | A deterministic, operator-visible paper-only flow from read-only snapshot to simulated PnL | IMPLEMENTED | Unit/integration tests, type check, event/session hashes, status handoff | Live venue mutation, credentials, capital, promotion, claim of economic validity |
| M2 — Paper Operations Evidence | Frozen research artifact is wired to long-running paper observation and a report | BLOCKED by evidence/paper-entry gates | Paper fills, latency/slippage comparison, drift and incident record | Shadow or live authority |
| M3 — Read-only Shadow Evidence | Predicted execution is compared with observed venue data and reconciled | BLOCKED by M2 and venue/reconciliation proof | Drift, reconciliation, restart and outage evidence | Mutation capability or canary |
| M4 — Future Release Dossier | Humans can decide whether a separately controlled next state is justified | PROHIBITED in this repository | All applicable GOV-01..GOV-12 evidence and explicit human decision | Automatic canary or production release |

## M1 acceptance contract

M1 is complete only when the following are true:

1. The input type contains only a read-only `getMarketSnapshot` capability.
2. A deterministic strategy emits `BUY`, `SELL`, or `HOLD`; invalid or failed
   strategy output is fail-closed.
3. Risk checks cap simulated order size, notional, inventory, and virtual cash
   before a paper order is created.
4. The existing deterministic paper executor, rather than a venue adapter,
   produces the simulated fill.
5. Simulated position, cost basis, realized/unrealized PnL, and virtual quote
   balance are derived only from the simulated fills.
6. An append-only-in-session event record and deterministic session hash make
   the result inspectable and replayable.
7. Operator status states `PAPER_ONLY`, `SIMULATED_ONLY`, `READ_ONLY_INPUT`,
   and live trading `PROHIBITED`.
8. Tests prove the happy path, a risk rejection, and deterministic replay.

## Persistent handoff

When a milestone changes, update `docs/agent-status.md` with the objective,
state, completed evidence, remaining work, blockers, validation commands, next
action, and files touched. Update this plan only when sequence, ownership, or
acceptance criteria change. Preserve the v2.9 review and safety documents as
the normative control layer.

## Next action after M1

Do not add a live adapter. The next scoped engineering task is to define the
M2 paper-operations evidence contract and its preconditions, while the Quant,
Risk, Execution, and independent-review owners close the relevant research and
operational gates. If those gates remain incomplete, M2 stays `BLOCKED` and
research/evidence work proceeds in parallel.
