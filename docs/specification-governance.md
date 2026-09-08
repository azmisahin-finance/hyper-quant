# Specification Governance and Multi-Perspective Operating Model

**Status:** `REVIEW_REQUIRED`  
**Applies to:** v2.9 candidate specification and all repository work  
**Operating posture:** non-live research and execution-safety platform

This document turns the v2.9 specification into an operating model. It defines who
may propose, review, decide, implement, evidence, pause, and escalate work. It
does not approve the v2.9 specification, production deployment, live trading,
signing, or access to real capital.

The normative sources remain, in order of authority:

1. `spec/versions/v2.9/HYPER-QUANT_MASTER_SPEC_v2.9.md`
2. the applicable versioned review artifact in `spec/reviews/v2.9/`
3. this operating model and the linked repository runbooks
4. implementation and experiment artifacts

If two documents disagree, use the stricter control, record the conflict, and
escalate it to the Architect and human approver. Never resolve ambiguity by
loosening a gate.

## 1. Operating principles

- `REVIEW_REQUIRED` is the current overall status; no row in the v2.9 matrix may
  be treated as approved.
- Research output is advisory. It cannot directly authorize an order, signer,
  credential, deployment, or capital allocation.
- Research and execution planes remain separate. The current repository is
  non-live and has no production authority.
- Every material operation has an owner, an accountable decision-maker, required
  evidence, an explicit next state, and a durable status update.
- Unknown, failed, stale, contradictory, or incomplete evidence produces
  `BLOCKED`, `NO_TRADE`, `INCONCLUSIVE`, or `REVIEW_REQUIRED`; it never produces
  an implicit pass.
- A future production gate is a human-approved release decision, not an agent
  action or an automatic consequence of passing tests.

## 2. Roles, purpose, and decision rights

| Role | Primary purpose | May decide | Must not decide or access |
| --- | --- | --- | --- |
| CEO | Mission, priorities, acceptable business risk, and stop/continue posture | Portfolio priority, pause/terminate program, request independent review | Technical evidence exceptions, signer use, live order or capital authorization in this repo |
| Quant | Hypotheses, statistical design, validation, and research evidence | Research design, trial interpretation, reject/no-trade recommendation | Holdout bypass, production promotion, hidden trial or parameter changes |
| Senior Engineer | Deterministic implementation, tests, observability, and repository integrity | Technical implementation readiness and rollback of a code change | Risk-limit weakening, production approval, signer or live endpoint access |
| Architect | System boundaries, contracts, dependencies, and specification traceability | Architecture conformance, interface acceptance, dependency escalation | Unreviewed spec change, live authority, unilateral release |
| Security Engineer | Threat model, isolation, secrets, capability and adversarial review | Security stop, security acceptance, required remediation | Credential issuance, signer operation, overriding a fail-closed control |
| Risk Manager | Risk budget, exposure, drawdown, limits, and capital policy | Risk acceptance within approved policy, risk stop, allocation recommendation | Increasing limits to rescue a result, live capital authorization |
| Trader | Market behavior, venue mechanics, execution assumptions, and operational context | Trading-use-case interpretation and market-operability recommendation | Sending orders, bypassing controls, treating a backtest as a fill |
| Execution Specialist | Fill, latency, slippage, reconciliation, and execution-safety evidence | Execution-model acceptance and reconciliation disposition | Live mutation, signer access, retrying unknown outcomes blindly |
| AI Researcher | Reproducible analysis, model proposals, review assistance, and evidence synthesis | Analysis recommendation only, within registered scope | Self-promotion, holdout access outside protocol, arbitrary code or production access |
| Investor | Capital-provider perspective, return/risk questions, and reporting challenge | Challenge assumptions, request evidence, support or decline a capital recommendation | Operational override, live execution, bypassing review gates |
| Product Manager | Scope, sequencing, acceptance criteria, and stakeholder communication | Backlog ordering and product acceptance when all control owners sign off | Trading or security exceptions, changing normative requirements |
| Operations/Compliance | Records, cadence, approvals, incidents, and policy traceability | Record completeness, process stop, escalation routing | Editing evidence to fit a decision, approving production alone |

The accountable party is still responsible when work is delegated. A delegate
may prepare an artifact; only the role with the decision right may accept it.

## 3. RACI-style lifecycle matrix

`A` = accountable decision owner, `R` = responsible executor, `C` = consulted,
`I` = informed. A blank cell means no default assignment; the accountable owner
must still ensure the handoff is complete.

| Lifecycle operation | CEO | Quant | Sr Eng | Architect | Security | Risk | Trader | Exec | AI | Investor | PM | Ops |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Idea and problem framing | A | R | C | C | C | C | R |  | C | C | R | I |
| Hypothesis and trial registration | I | A/R | C | C | C | C | C | C | R | I | R | R |
| Data, feature, and replay readiness | I | A | R | C | C | C | C | C | R |  | C | R |
| Backtest and statistical validation | I | A/R | R | C | C | C | C | C | R | I | C | R |
| Paper evaluation | I | A | R | C | C | C | R | C | R | I | C | R |
| Shadow evaluation | I | A | R | C | C | C | C | A/R | C | I | C | R |
| Canary readiness proposal | C | C | R | C | A | A | C | A/R | I | C | R | R |
| Future production gate | A | C | C | A | A | A | C | C | I | C | R | R |
| Incident, stop, or rollback | C | C | R | C | A | A | C | R | I | I | C | R |
| Reporting and evidence ledger | A | R | R | C | C | R | C | C | C | C | A | A/R |

No matrix row grants live authority. The canary and production rows describe
future review work only; the current state remains `REVIEW_REQUIRED` and
non-live.

## 4. End-to-end lifecycle and handoffs

The lifecycle is:

`IDEA -> HYPOTHESIS -> RESEARCH -> BACKTEST -> VALIDATED -> PAPER -> SHADOW -> CANARY -> FUTURE PRODUCTION GATE`

Each phase produces an immutable or hash-addressed artifact, a decision record,
and a next-state decision. A failed or ambiguous phase returns to research,
rejects the candidate, or pauses the program.

| Phase | Required inputs | Required outputs | Accountable acceptance | Dependencies |
| --- | --- | --- | --- | --- |
| Idea | Problem, venue/asset context, expected mechanism | Scoped idea brief and risk questions | Product Manager with Quant and Trader consultation | Current v2.9 scope |
| Hypothesis | Idea, falsifiable mechanism, success/failure metrics | Registered trial receipt, family identity, budget, pre-declared policy | Quant | Immutable research identity and data contract |
| Research | Receipt, data lineage, code/artifact identity | Reproducible analysis, negative controls, raw and failed results | Quant; Senior Engineer confirms reproducibility | Data quality and ledger availability |
| Backtest | Research artifact, realistic cost/fill model | OOS/walk-forward results, diagnostics, evidence hash | Quant and Execution Specialist | No leakage; cost model; trial count |
| Validated | Finalized campaign and controlled holdout reservation | Promotion decision: `PROMOTE_CANDIDATE`, `REJECT`, `NO_TRADE`, or `INCONCLUSIVE` | Quant with Risk and independent review | Holdout isolation and v2.9 gates |
| Paper | Frozen artifact and paper execution profile | Paper trades, predicted/realized execution comparison, incident log | Trader and Execution Specialist | Validated candidate; no capital |
| Shadow | Paper evidence, live-read-only observations, drift policy | Shadow report and reconciliation evidence | Execution Specialist; Risk accepts exposure model | Read-only venue observation; no mutation |
| Canary | Approved shadow report, risk budget, rollback plan | Canary proposal, allocation cap, stop triggers | Risk, Security, Architect, and human approver | Spec approval and external controls; not available now |
| Future production gate | All prior evidence plus independent review | Human release record or explicit rejection | CEO plus accountable control owners | Approved spec, signer isolation, capability parity, external gateway |

After every phase, Operations/Compliance records the decision, evidence links,
owner, reviewers, unresolved blockers, and the exact next action. No phase may
silently skip a state or convert a simulation result into a production fact.

## 5. Entry and exit criteria

### Common entry criteria

- Objective and scope are written.
- Applicable v2.9 section and review status are identified.
- Owner, accountable role, dependencies, and stop conditions are named.
- Inputs have lineage and do not contain secrets or live credentials.
- The proposed work is classified as research, safety, venue observation,
  governance, or release.

### Common exit criteria

- Acceptance criteria are met or the result is explicitly rejected,
  inconclusive, or blocked.
- Tests and deterministic checks cover material failure paths.
- Evidence is reproducible from recorded inputs, code, configuration, and hashes.
- Security and risk reviewers have signed off where their boundary is touched.
- The status ledger and decision record are updated.
- The next state and owner are explicit; unresolved blockers remain visible.

### Non-live phase-specific gates

- **Research/backtest:** registered trial, immutable data identity, leakage
  controls, realistic costs, multiple-testing accounting, and preserved failures.
- **Validated/paper:** finalized campaign, controlled holdout, frozen artifact,
  explicit promotion policy, and no raw holdout leakage.
- **Shadow:** read-only observations, predicted-versus-realized fill/latency/
  slippage comparison, drift monitoring, and reconciliation evidence.
- **Canary/future production:** not enabled by this repository. It additionally
  requires an approved specification, independent adversarial review, external
  signer and credential isolation, capability parity, bounded allocation, and a
  human release record.

## 6. Decision records and escalation

Every material decision uses a durable record with:

- decision ID, date, specification version, and status;
- question, options considered, chosen outcome, and rationale;
- evidence hashes/links, trial and artifact identities;
- accountable owner, responsible executor, consulted reviewers, and informed
  recipients;
- dependencies, risk/security assessment, expiry or review date;
- next state, rollback/stop trigger, and unresolved blockers.

Escalate immediately to Security and Risk for credentials, signer boundaries,
unknown venue outcomes, kill-switch or hard-limit changes, data integrity
incidents, exposure disagreement, or any suspected leakage. Escalate to the
Architect and human approver for specification identity changes, release
claims, production capability, or conflicts between normative documents.

## 7. Mandatory post-operation checklist

The operation owner must complete this checklist before marking work complete:

1. Run the smallest relevant existing tests, then `npm run check` and `npm test`
   when the change is repository-wide or governance-significant.
2. Run `node scripts/agent-status.mjs` and record the result and remaining
   blockers.
3. Preserve raw results, failures, logs, evidence hashes, and artifact identity;
   do not report a derived success without its inputs.
4. Update the decision record, `docs/agent-status.md`, and directly related
   documentation.
5. Review the diff for secrets, signer paths, live endpoints, test-only
   capability leakage, and accidental gate weakening.
6. Commit with a descriptive message and the required Copilot co-author trailer.
7. Push the feature branch. Open or update a PR targeting `main`; never
   force-push or rewrite history.
8. Record the exact commit, branch, PR state, validation output, blockers, and
   next action for the next operator.

A commit or PR is not an approval to deploy. Merge policy remains subject to
required human review, CI, independent security/adversarial review, and the
current `REVIEW_REQUIRED` status.

## 8. CEO and investor reporting

Reports are issued for 7-day, 30-day, 90-day, and 180-day horizons and include:
capital at risk (zero for this repository), net and risk-adjusted results,
drawdown, qualified observations/trades, strategy health, execution quality,
data health, incidents, research progress, evidence completeness, and open
proof obligations. Each report states `REVIEW_REQUIRED`, `PROHIBITED` live
trading status, and whether the result is `CONTINUE`, `PIVOT`, `PAUSE`, or
`TERMINATE`.

CEO and Investor questions are answered with evidence and uncertainty, not
return promises. An investor request for faster deployment, higher allocation,
or omitted controls is a challenge to be recorded and escalated, not an
authorization to bypass gates.

## 9. Security and risk stop conditions

Immediately stop the affected operation and preserve evidence for any:

- secret, credential, signer, private-key, or live endpoint exposure;
- attempt to submit, amend, cancel, resize, or authorize a live order;
- kill, dependency, policy, hard-risk, or reconciliation gate bypass;
- unknown exchange outcome, stale authorization, broken hash, or journal failure;
- data gap, leakage, unregistered trial, holdout contamination, or artifact
  identity mismatch;
- unexplained drawdown, exposure breach, model/data drift, or failed rollback;
- contradiction between the specification, review record, and implementation.

The stop state is fail-closed: `NO_TRADE`, `BLOCKED`, `PAUSE`, or
`REVIEW_REQUIRED`. Safety-triggered shutdowns do not auto-resume. Resume requires
recorded root cause, corrective evidence, risk/security acceptance, and the
applicable human decision.

## 10. AI agent autonomy boundaries

An AI agent may read repository artifacts, propose hypotheses, run registered
non-live research, implement reviewed code/docs, run tests, produce evidence,
open a PR, and report uncertainty. It may not:

- promote itself or a strategy;
- approve a specification, release, capital allocation, or production gate;
- access or request signer keys, production credentials, or live order paths;
- bypass trial registration, holdout isolation, risk limits, or reconciliation;
- hide failed variants, alter historical evidence, or claim unverified success;
- turn paper, shadow, testnet, or canary observations into production authority;
- auto-resume after a safety stop or merge a change that requires human approval.

When uncertain, the agent records the uncertainty and chooses the stricter
state. Human reviewers remain accountable for governance and release decisions.
