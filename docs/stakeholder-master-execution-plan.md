# HYPER-QUANT Stakeholder Master Execution Plan

**Status:** `REVIEW_REQUIRED` / `NON_LIVE`  
**Specification baseline:** v2.9 candidate, independent adversarial review required  
**Canonical use:** stakeholder planning, agent handoff, engineering sequencing, and evidence tracking  
**Last updated:** 2026-09-09

This is the master execution plan for completing HYPER-QUANT safely. It is a
roadmap and task register, not a production approval, investment promise, or
authorization to access live capital. A task is not complete because code
exists: its required evidence, acceptance criteria, review record, and
downstream consequence must also be closed.

## 1. Current truth and operating boundaries

- The authoritative candidate is `spec/versions/v2.9/HYPER-QUANT_MASTER_SPEC_v2.9.md`.
- `spec/master/` contains no approved master. The project remains
  `REVIEW_REQUIRED`.
- The repository contains non-live reference controls, deterministic tests,
  read-only venue/data scaffolding, replay, research ledgers, and evidence
  packaging. These do not prove profitability, live connectivity, signer
  isolation, production reconciliation, or production readiness.
- No agent, test, adapter, CI job, or stakeholder may submit, amend, cancel,
  resize, authorize, or settle a live order from this repository.
- No real capital, exchange credential, private key, seed, wallet, signer, or
  production export belongs in this repository or the research/AI plane.
- `NO_TRADE`, `BLOCKED`, `INCONCLUSIVE`, `PAUSE`, and `REVIEW_REQUIRED` are
  valid terminal or intermediate outcomes. Unknown state never becomes success.

Normative precedence is: v2.9 specification, applicable review artifact,
`docs/specification-governance.md`, this plan, implementation artifacts. A
conflict uses the stricter control and is escalated to the Architect and human
approver.

## 2. Role responsibilities and outputs

| Role | Owns | Required outputs | Decision rights and limits |
| --- | --- | --- | --- |
| CEO | Mission, priority, acceptable business risk, stop/continue posture | Charter, portfolio priority, pause/terminate record, 7/30/90/180 decision | May prioritize or stop; may not waive evidence, approve signer use, or authorize live capital in this repo |
| CTO | Technical investment, platform capacity, engineering standards | Technical strategy, staffing/capacity decision, architecture escalation | May commit engineering capacity; may not weaken safety or release gates |
| Product Manager | Scope, sequencing, acceptance criteria, stakeholder communication | Backlog, milestone brief, acceptance record, stakeholder updates | May order work and accept product scope only after control owners accept their boundaries |
| Quant | Hypotheses, statistical design, validation, research interpretation | Trial receipt, analysis, diagnostics, promotion or `NO_TRADE` recommendation | May design and reject research; may not bypass holdout or promote to production |
| AI Researcher | Reproducible analysis, model proposals, evidence synthesis | Registered proposals, notebooks/artifacts, negative controls, uncertainty statement | Advisory only; no self-promotion, hidden trials, holdout bypass, or production access |
| Senior Engineer | Deterministic implementation, tests, observability, repository integrity | Code, tests, run logs, incident fixes, rollback plan | May declare technical readiness; may not change risk policy or access signer/live endpoints |
| Architect | Contracts, boundaries, dependencies, specification traceability | Architecture decisions, interface map, conformance review | May accept architecture; may not approve an unreviewed spec or release alone |
| Security Engineer | Threat model, isolation, secrets, capability and adversarial review | Threat model, security findings, isolation evidence, security stop/acceptance | May stop work and require remediation; never issues or operates credentials |
| Risk Manager | Risk budget, exposure, drawdown, limits, capital policy | Risk register, limit policy, stress report, allocation recommendation | May stop and accept risk within approved policy; may not raise limits to rescue results |
| Trader | Market behavior, venue mechanics, use-case interpretation | Market assumptions, venue review, operability assessment, paper review | May challenge assumptions; may not send orders or treat a backtest as a fill |
| Execution Specialist | Fills, latency, slippage, reconciliation, execution safety | Cost/fill model, paper/shadow comparison, reconciliation report | May accept execution evidence or stop; no live mutation or blind retry |
| Investor | Capital-provider questions, return/risk challenge | Evidence questions, capital review record, support/decline recommendation | May challenge or decline funding; may not bypass controls or operate the system |
| Operations/Compliance | Records, cadence, approvals, incidents, policy traceability | Decision log, evidence index, reports, incident/escalation record | May stop for missing records and route escalation; may not edit evidence to fit a decision |

### RACI and decision rights

`A` is accountable, `R` responsible, `C` consulted, `I` informed.

| Workstream | CEO | CTO | PM | Quant | AI | Sr Eng | Arch | Sec | Risk | Trader | Exec | Investor | Ops |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Specification closure | A | C | R | C | I | C | A | C | C | C | C | I | R |
| Research registration and validation | I | C | R | A/R | R | R | C | C | C | C | I | I | R |
| Data/economic realism | I | C | R | A | C | R | C | C | C | R | R | I | R |
| Safety and execution boundary | I | A | I | C | I | R | A | A | A | C | R | I | R |
| Paper/shadow readiness | I | C | R | A | C | R | C | C | A | R | R | I | R |
| Future canary/production gate | A | C | R | C | I | C | A | A | A | C | R | C | R |
| Incident, stop, rollback | C | C | I | C | I | R | C | A | A | C | R | I | R |
| Reporting and evidence ledger | A | C | A/R | R | C | R | C | C | R | C | C | C | A/R |

No RACI row grants current live authority. Future canary and production rows
remain conditional on human approval and all proof obligations.

## 3. Phase sequence and exit gates

1. **Specification closure:** reconcile v2.9 identity, review matrix,
   adversarial findings, Definition of Done, and independent review. Until
   closed, no approved master or production claim exists.
2. **Non-live research foundation:** register hypotheses, preserve immutable
   data lineage, run deterministic replay/backtests, account for every trial,
   and retain failures and negative controls.
3. **Data and economic realism:** establish authoritative venue rules, fees,
   minimums, latency, liquidity, funding, fill, slippage, outage, and
   operational cost evidence. A model that cannot survive realistic costs is
   `REJECT` or `NO_TRADE`.
4. **Statistical and holdout closure:** complete walk-forward, purge/embargo,
   CSCV/PBO, independently validated DSR/PSR, regime coverage, physical
   holdout isolation, post-holdout sealing, and reproducible evidence package.
5. **Operations readiness:** incident, access, observability, backup/restore,
   reconciliation, runbook, compliance record, and stop/rollback rehearsal.
6. **Paper evaluation:** frozen candidate only; compare predicted and realized
   fills, latency, slippage, costs, drift, and operational incidents with zero
   capital.
7. **Read-only shadow evaluation:** venue observation and reconciliation only;
   no mutation capability. Stop on unknown state, drift, data gaps, or control
   mismatch.
8. **Future canary gate:** only after an approved specification, independent
   security/adversarial review, external signer and mutation gateway, bounded
   allocation, rollback, and a human release record. Not available today.
9. **Future production gate:** explicit human approval by accountable control
   owners, capability parity, venue proof, reconciliation proof, risk
   acceptance, and expiry/review date. Never an automatic consequence of tests.

Every phase must produce an immutable or hash-addressed artifact, a decision
record, an owner, reviewers, unresolved blockers, and a named next state.

### Productization decision

The engineering path now starts with a usable zero-capital M1 paper-bot vertical
slice while research and proof obligations continue in parallel. Its fixed flow
is read-only market input → deterministic strategy → risk decision → paper
order/fill → simulated position/PnL → event record → operator status. M1 is an
implementation capability, not evidence that a candidate may enter the
`OPS-02` paper-evaluation phase. The authoritative M1 acceptance contract and
subsequent sequence are in `docs/productization-master-plan.md`.

## 4. Master task register

Status vocabulary: `DONE` means evidence-backed and accepted; `PARTIAL` means
reference implementation exists but proof is incomplete; `OPEN` means work is
not closed; `BLOCKED` means a prerequisite or human decision prevents work;
`PROHIBITED` means intentionally unavailable in this repository.

| ID | Priority | Owner | Dependencies | Required evidence | Acceptance criteria | Deliverable/output | Release consequence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GOV-01 | P0 | Architect / Ops | v2.9 candidate | identity matrix, review links, hashes | Header, filenames, references, matrix, and status agree | specification closure record | Blocks approved master and every later gate | OPEN |
| GOV-02 | P0 | CEO / Architect | GOV-01 | independent adversarial review and responses | All P0/P1 findings closed or explicitly accepted by human authority | signed review disposition | Blocks production claims | OPEN |
| GOV-03 | P0 | PM / Ops | GOV-01 | accountable owner, RACI, decision log | Every material task has owner, A, evidence, next state | governed backlog and ledger | Ownerless work is blocked | PARTIAL |
| GOV-04 | P0 | Security / Architect | GOV-01 | threat model, capability manifest, negative tests | Research/AI cannot reach signer, credentials, or mutation gateway | isolation proof package | Blocks canary and production | PARTIAL |
| GOV-05 | P0 | Quant / Sr Eng | GOV-03 | trial receipts, raw/failed variants, campaign ledger | All material trials are registered before compute and counted | research integrity ledger | Blocks promotion evidence | PARTIAL |
| GOV-06 | P0 | Quant / Security | GOV-05 | sealed storage/process design, access audit, contamination tests | Holdout is physically/process isolated and sealed after use | holdout control certification | Blocks validation and promotion | OPEN |
| GOV-07 | P0 | Quant / independent reviewer | GOV-05 | independent DSR/PSR reproduction and convention comparison | Statistics match production conventions and campaign lineage | statistical validation report | Blocks statistical acceptance | OPEN |
| GOV-08 | P1 | Quant / Architect | GOV-05 | declared taxonomy, classifier tests, segment hashes | Economic regimes are defined, reproducible, and covered | regime model and coverage report | Limits evidence to declared segments | OPEN |
| GOV-09 | P0 | Sr Eng / Execution | GOV-04 | venue docs, connectivity/reconnect logs, replay parity | Read-only/live-observation behavior is certified without mutation | venue operations certification | Blocks shadow and later gates | OPEN |
| GOV-10 | P0 | Security / Execution | GOV-04 | external signer design, gateway tests, least-privilege audit | Signer is external, isolated, auditable, and fail-closed | signer boundary review | Blocks all live mutation | PROHIBITED |
| GOV-11 | P0 | Execution / Risk | GOV-09 | unknown-outcome, reconciliation, outage, and restart evidence | Exchange truth reconciles exposure; no blind retry or auto-resume | reconciliation certification | Blocks canary and production | OPEN |
| GOV-12 | P0 | Risk / CEO / Human approver | GOV-02, GOV-06, GOV-07, GOV-10, GOV-11 | complete release dossier and signed decision | Human decision explicitly approves or rejects bounded next state | release/stop record | No approval means `REVIEW_REQUIRED` | OPEN |
| RES-01 | P1 | Quant | GOV-03 | registered hypotheses and family budget | Discovery allocation and falsification criteria frozen pre-result | hypothesis portfolio | No unregistered research may count | OPEN |
| RES-02 | P1 | Sr Eng / Quant | RES-01 | immutable data/replay hashes and gap report | Deterministic replay reproduces event/order hashes | dataset and replay certificate | Blocks backtest evidence | PARTIAL |
| RES-03 | P1 | Quant / Exec | RES-02 | fees, spread, slippage, funding, latency, liquidity tests | Cost model is conservative and venue-specific | economic realism report | Rejects non-executable edge | OPEN |
| RES-04 | P1 | Quant | RES-02, RES-03 | OOS/walk-forward, purge, embargo, negative controls | Candidate survives declared statistical protocol | validation dossier | Candidate remains research-only otherwise | PARTIAL |
| RES-05 | P1 | Quant / Risk | RES-04, GOV-06, GOV-07 | campaign, holdout, evidence package | Promotion state is deterministic and traceable | candidate decision record | Only `PROMOTE_CANDIDATE` may enter paper | PARTIAL |
| OPS-01 | P1 | Ops / Security | GOV-04 | access inventory, redacted logs, backup/restore, incident drills | Operations can detect, stop, restore, and preserve evidence | operations readiness pack | Blocks shadow | OPEN |
| M1-01 | P0 | Product / Sr Eng | v2.9 safety boundary | deterministic tests, event/session hashes, operator status | Read-only data flows through strategy, risk, paper executor, simulated PnL, and status without a live capability | paper-only product vertical slice | Does not satisfy OPS-02 or permit capital | PARTIAL |
| OPS-02 | P1 | Execution / Trader | OPS-01, RES-05 | paper fills, latency, slippage, drift, incident log | Frozen candidate meets paper acceptance without capital | paper evaluation report | Failure returns to research | OPEN |
| OPS-03 | P0 | Execution / Risk | OPS-02, GOV-09, GOV-11 | read-only shadow observations and reconciliation | Shadow demonstrates control parity and stop behavior | shadow readiness/exit record | No canary proposal otherwise | OPEN |
| REL-01 | P0 | Architect / Security / Risk | GOV-12, OPS-03 | bounded allocation, rollback, expiry, human approval | Canary is explicitly approved and externally controlled | canary proposal | Not executable from this repo | PROHIBITED |
| REL-02 | P0 | CEO / human approver | REL-01 | production dossier, independent review, capability parity | Release decision is signed, time-bounded, and reversible | production gate record | No automatic production | PROHIBITED |
| REP-01 | P1 | PM / Ops | all active work | 7/30/90/180 scorecards and decisions | Reports state evidence, uncertainty, capital at risk, and action | stakeholder report pack | Missing report keeps phase open | OPEN |
| HND-01 | P1 | Ops / PM | every completed task | status, blockers, validation, files, next action | Agent handoff is resumable and current | updated status ledger | Stale state blocks safe continuation | PARTIAL |

## 5. Explicit implementation gaps

The following are known gaps, not implied completions: independent DSR
validation; full candidate-generation-to-ledger orchestration; economic regime
classification; physical sealed-holdout isolation and post-holdout sealing;
cross-process ledger locking; live WebSocket/reconnect certification; venue
rate-limit and outage proof; external signer isolation; live venue mutation
reconciliation; production database/filesystem durability; operational
backup/restore and incident drills; capability parity beyond local tests; and
independent human/adversarial review closure. The current evidence engine and
ledger controls are valuable reference implementations but remain
`PARTIAL` where these external or independent proofs are absent.

## 6. Reporting cadence and stakeholder-ready checklist

Each report must state `REVIEW_REQUIRED`, live status `PROHIBITED`, capital at
risk (currently zero), net and risk-adjusted results where applicable,
drawdown, qualified observations/trades, strategy/data/execution health,
incidents, research progress, evidence completeness, open GOV obligations,
decision (`CONTINUE`, `PIVOT`, `PAUSE`, or `TERMINATE`), accountable owner, and
next gate. No horizon alone authorizes deployment.

| Horizon | Primary question | Minimum evidence and decision |
| --- | --- | --- |
| 7 days | Is the system operationally viable? | Uptime, gap/crash record, deterministic replay, control violations, venue facts; `PAUSE/FIX` on failure |
| 30 days | Is research reproducible? | Immutable baseline, registered trials, realistic cost sanity, leakage check, negative control; `PIVOT/CONTINUE`, no capital |
| 90 days | Is evidence strong enough for paper/shadow? | OOS/walk-forward, holdout status, execution comparison, drift, frozen hashes; keep research or pivot |
| 180 days | Is there defensible economic viability? | Independent evidence and controlled observations, or explicit blocker economics; CEO/Investor choose pivot, rescope, or terminate |

Before stakeholder sign-off, verify: current spec/status are visible; all task
IDs have owner and evidence; failed variants and uncertainty are retained;
security/risk reviewers signed where required; no secrets or live artifacts are
present; next state and stop trigger are named; and the decision is recorded.

## 7. Autonomous agent handoff and post-operation checklist

An autonomous agent may read, propose, implement reviewed non-live changes, run
registered research, test, document, and open a PR. It may not approve a spec,
release, capital allocation, signer, or production gate; access credentials;
change risk limits; bypass registration/holdout/reconciliation; hide failures;
or auto-resume after a stop.

At close, the agent must:

1. Record objective, current status, completed work, remaining work, blockers,
   validation, next action, and exact files in `docs/agent-status.md`.
2. Preserve raw results, failures, logs, hashes, and artifact identity.
3. Run the smallest relevant checks plus the repository checks required by the
   runbook for governance-significant work.
4. Review the diff for secrets, live endpoints, signer paths, and gate
   weakening.
5. Commit descriptively with the Copilot co-author trailer, push the branch,
   and open/update a PR targeting `main` when permitted.
6. Leave the next operator a named owner and a resumable blocker, never a
   narrative claim of readiness.

## 8. Stop conditions and human approval gates

Stop immediately and preserve evidence on any credential/signer/live endpoint
exposure; live order attempt; kill, dependency, policy, hard-risk, or
reconciliation bypass; unknown exchange result; stale authorization; broken
hash/journal; data gap or leakage; unregistered trial; holdout contamination;
artifact mismatch; unexplained drawdown/exposure breach; failed rollback;
contradictory normative documents; or missing accountable approval.

The fail-closed result is `NO_TRADE`, `BLOCKED`, `PAUSE`, or
`REVIEW_REQUIRED`. Resume requires root cause, corrective evidence,
Security/Risk acceptance, and the applicable human decision. Canary and
production require all GOV-01..GOV-12 applicable evidence, an approved
specification, independent review, external signer/mutation boundary, bounded
risk, rollback, expiry, and an explicit human release record. None is granted
by this plan, by passing tests, by a PR merge, or by a profitable simulation.

## 9. Completion definition

Project completion is not “a strategy made money.” It is a traceable human
decision that the intended scope is either safely approved for its explicitly
bounded next state or deliberately rejected/terminated. For any future live
state, completion additionally requires approved specification identity,
independent adversarial/security review, realistic and independently reproduced
economic evidence, sealed holdout, operational readiness, venue/reconciliation
proof, external signer isolation, capability parity, risk acceptance,
rollback/stop rehearsal, time-bounded human approval, and a durable release
record. Until then, the correct project state remains `REVIEW_REQUIRED`,
non-live, and no-capital.
