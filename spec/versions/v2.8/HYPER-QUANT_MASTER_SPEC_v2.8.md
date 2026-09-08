# HYPER-QUANT MASTER SPEC v2.8
## Quant Research, Capital Growth, Risk, Multi-Venue Data & Execution Platform

**Status:** MASTER SPECIFICATION — REVIEW_REQUIRED / v2.8 HARDENING / INDEPENDENT ADVERSARIAL REVIEW REQUIRED

**Revision:** v2.8 is a hardening amendment to v2.7. It converts the previously scaffolded execution-safety contracts into a stricter executable boundary: scope-aware kill applicability, hashed authorization snapshots, fresh-time expiry validation, explicit hard-risk/dependency/policy gates, canonical intent transitions, bounded reconciliation, and a durable append-only intent journal. It retains v2.7 as the prior review artifact and does not grant production approval.
**Version:** 2.8
**Date:** 2026-09-08
**Supersedes as strategic authority:** HYPER-QUANT v2.6; v2.0; v1.5 remains normative only where explicitly retained as the Safety/Execution Kernel
**Retained from v1.5:** Safety/Execution Kernel requirements remain normative unless explicitly amended by this document.
**Primary launch principle:** smallest viable real capital, smallest viable scope, evidence-first scaling.
**Non-goal:** guarantee profits, guarantee prediction accuracy, or guarantee capital multiplication.

**v2.8 adversarial remediation summary:** carries forward v2.6 remediations and closes the Round-5 P1 findings for execution state/persistence, artifact/dependency identity, holdout-budget hierarchy, scope-aware kill authorization, deterministic promotion policy, aggregate exposure, and test/production capability parity.

**Specification identity rule:** `Revision`, `Version`, document title, section references, architecture labels, generated filenames, and release metadata must identify the same specification version. A mismatch is a P2 blocker and prevents `APPROVED_FOR_IMPLEMENTATION` until corrected.

**v2.8 hardening amendments:** this version retains all v2.7 normative controls and adds executable enforcement for the safety-kernel subset: canonical transition validation, durable intent journal primitives, bounded reconciliation contracts, scope-aware kill applicability, authorization-hash verification, fresh-clock expiry checks at each validation point, explicit hard-risk/dependency/execution-policy predicates, and a cross-platform deterministic test runner. Research-plane statistical, holdout, artifact-identity, promotion, portfolio-risk, and live-venue capabilities remain `REVIEW_REQUIRED` until their executable implementations and evidence gates exist.

---

# 0. Executive Definition

HYPER-QUANT is not defined as a single trading bot.

It is a **quantitative research, validation, decision, risk, and execution platform** whose first production manifestation may be a deliberately small and narrow trading system on a single venue and asset.

The platform shall be able to:

1. ingest and preserve high-quality market/account data,
2. generate and test trading hypotheses,
3. discover and evaluate statistical edge,
4. estimate conditional probabilities and expected value,
5. model real trading costs and execution uncertainty,
6. reject weak or overfit strategies,
7. deploy only validated strategies,
8. execute them through a safety-constrained execution kernel,
9. detect strategy degradation and market-regime changes,
10. reduce or stop capital allocation when the evidence deteriorates,
11. increase capital only when pre-defined evidence gates are satisfied,
12. leave an auditable trail that another engineer, quant, architect, security reviewer, or AI model can independently inspect.

The system uses firm-grade research, governance, and safety discipline, but it is not assumed to possess a firm-grade structural edge, proprietary data advantage, co-location advantage, or institutional capital scale. It is therefore better defined as a **disciplined individual quantitative research program with firm-grade safety**, not as a miniature institutional fund.

---

# 1. Mission

## 1.1 Primary mission

Build the smallest practical system capable of demonstrating **real, repeatable, net-positive trading expectancy after fees, spread, slippage, funding where applicable, execution effects, and operational costs**, while limiting capital at risk and preserving the ability to stop immediately when evidence becomes unreliable.

The mission is deliberately asymmetric: **finding no deployable edge is an acceptable and potentially high-value outcome** when the evidence is reliable. A failed strategy does not erase the value of an immutable data pipeline, event-driven replay engine, research-integrity ledger, statistical validation framework, or safety/execution kernel that can be reused for later hypotheses, venues, and asset classes.

## 1.2 Capital-growth interpretation

A user may begin with a very small capital amount such as TRY 500. The system shall not promise that TRY 500 can become TRY 500,000, 5,000,000, or any other target.

The product requirement is instead:

> Start with the smallest capital that is operationally meaningful for the selected venue/market; prove positive net expectancy; preserve capital; increase allocation only when evidence and risk gates justify it.

A capital trajectory such as:

`500 → 700 → 1,100 → 2,000 → 4,000 → 8,000 ...`

is a possible outcome, not a guaranteed roadmap.

The system must optimize for **risk-adjusted capital growth**, not for a predetermined multiple.

## 1.3 Secondary mission

Discover whether **retail-accessible, persistent, statistically defensible, executable market anomalies** exist. Research shall prioritize mechanisms that do not depend on winning a pure latency race with professional HFT infrastructure.

The discovery order is intentionally asymmetric:

1. **Structural / venue-specific effects** — measurable liquidity, spread, session, fee, inventory, fragmentation, or market-design effects available on the selected venue.
2. **Financing / funding / basis effects** — carry, funding, basis, or related persistent financing dislocations where the required capital, hedge, borrow, and execution mechanics are actually available.
3. **Cross-venue informational effects** — lead/lag, divergence, or price/flow dislocations using multi-venue data, with execution separated from research unless separately approved.
4. **Microstructure / short-horizon effects** — only where measured latency, fees, spread, and fill mechanics leave a demonstrated economic margin.
5. **Inherited mean-reversion baseline** — retained primarily as a falsification benchmark and continuity reference, not presumed to deserve the largest discovery budget.

The initial research-program charter shall cap the inherited baseline family at **25% of hypothesis-trial budget** until it demonstrates independent economic viability. Structural plus financing families shall receive at least **50% of the initial discovery trial budget**. The exact sub-allocation of the remaining budget must be frozen before empirical results are observed and recorded in the research ledger.

These are research priorities, not claims that any category is profitable. Each category remains subject to the same falsification, cost, overfitting, capital, operational, and execution gates.

## 1.3.1 External empirical context (non-normative)

External evidence supports caution, not optimism. A Brazilian equity-futures study of individuals who persisted in day trading for more than 300 days found that 97% lost money net of fees; this result is not directly transportable to crypto or to an automated research system, but it is a useful base-rate warning against assuming that trading discipline alone creates edge.

A 2026 cryptocurrency microstructure study found that minute-level microstructure features contained some information but that its tested strategies did not survive realistic exchange fees at the evaluated retail fee level. A separate 2026 study of cryptocurrency funding-rate markets found substantial arbitrage spreads but also frequent spread reversals and materially constrained net profitability after transaction costs. These findings support the specification's requirement that **economic mechanism, duration, execution cost, and venue-specific friction be demonstrated rather than assumed**.

A 2026 Traders Union survey also reports high retail use of AI/algorithmic tools but materially smaller self-reported rates of profitability improvement. Because this is proprietary survey evidence rather than a controlled performance study, it is treated only as contextual evidence and never as a quantitative promotion gate.

Reference set for this context: Chague, De-Losso & Giovannetti, *Day Trading for a Living?* (2020); Pindza, *Microstructure alpha: hierarchical learning and cross-asset transfer in cryptocurrency markets* (2026); Zhivkov, *The Two-Tiered Structure of Cryptocurrency Funding Rate Markets* (2026); Traders Union, *How Traders Use AI* (2026).

## 1.4 Product success is empirical, not narrative

The project does not define success as a return multiple. It defines success as the ability to repeatedly convert validated market conditions into positive net expectancy while staying within risk, execution, operational, and governance limits.

The initial economic test is intentionally small-capital. A starting balance such as TRY 500 is treated as a candidate experimental budget, not as a guaranteed viable trading bankroll. Before any order is allowed, the system must calculate `MINIMUM_VIABLE_CAPITAL` from current venue minimums, fees, spread, expected execution costs, and the strategy's minimum economically meaningful position size.

If the candidate capital is below that threshold, the correct result is `CAPITAL_BELOW_MINIMUM_VIABLE_THRESHOLD`; the system must not force a trade merely to satisfy a capital-growth narrative.

## 1.5 Mandatory business cadence

Management reporting shall be defined for 7-day, 30-day, 90-day, and 180-day horizons. Each horizon must report: capital at risk, net PnL, net expectancy, maximum drawdown, number of qualified trades, strategy health, execution quality, data health, incidents, research progress, and evidence completeness.

The system shall never use a time horizon alone as a reason to deploy capital. Each horizon is a decision gate with measurable operational, research, economic, and safety evidence.

The project may be paused, pivoted, or terminated for any of the following: no economically meaningful edge after disciplined research; edge disappears after realistic execution costs; live/shadow execution materially contradicts validated assumptions; operational risk exceeds approved limits; data quality is inadequate; security policy is violated; or research complexity exceeds demonstrated economic value.

## 1.6 Management scorecard and decision gates

The following are normative management gates. They are not profit guarantees. Any future tightening is permitted; silent weakening is forbidden.

### 7-day gate — operational viability

All must be true:

- selected-market recorder uptime >= 99.5% over the evaluation window;
- no unhandled process crash;
- no market-data gap longer than 60 seconds without a recorded and explained outage state;
- 100% of replay samples used for determinism tests reproduce identical event/order hashes;
- zero known credential, signing, or authorization-policy violations;
- all critical failure paths produce a deterministic safe state;
- current venue rules, fees, minimums, rate limits, and supported order semantics are recorded from authoritative documentation or the system is SPEC_BLOCKED;
- no real capital is required.

Failure action: **PAUSE / FIX**.

### 30-day gate — research viability

All must be true:

- at least one complete baseline dataset with immutable lineage exists;
- at least one fully reproducible baseline strategy experiment exists;
- execution-cost model has passed replay sanity checks against observed market mechanics;
- no critical look-ahead/data-leakage defect is open;
- 100% of material strategy/model trials are present in the research ledger;
- at least one negative-control experiment is present to detect accidental alpha from leakage or simulator artifacts.

Failure action: **PIVOT / RESEARCH CONTINUES; NO LIVE CAPITAL**.

### 90-day gate — evidence viability

All must be true for any strategy candidate to advance:

- at least one candidate completes the defined OOS/walk-forward/overfitting protocol;
- at least one candidate either passes the research-to-shadow gate or is formally rejected with evidence;
- shadow execution compares predicted versus realized fill probability, latency, slippage, and net expectancy;
- model, strategy, feature, and data drift monitoring is operational;
- the candidate's exact artifact hashes, parameter set, and trial-count lineage are frozen for review.

Failure action: **KEEP IN RESEARCH or PIVOT; NO CAPITAL SCALING**.

### 180-day gate — economic viability

At least one strategy must either:

1. demonstrate positive net expectancy in independently evaluated and shadow/controlled live conditions while staying inside risk policy, or
2. provide strong reproducible evidence of a promising edge whose production blocker is explicitly identified and economically justified.

Otherwise the CEO/Investor review must decide whether to **PIVOT, RE-SCOPE, or TERMINATE**.

No management report may convert an unresolved blocker into a green status by narrative explanation alone.

# 2. What This Specification Is / Is Not

## 2.1 This specification is

- an implementation contract,
- a research contract,
- a risk contract,
- an execution contract,
- a validation contract,
- a deployment/promotion contract,
- and a review contract.

## 2.2 This specification is not

- a promise of investment returns,
- a promise of winning trades,
- a fixed prediction model,
- a statement that one strategy is inherently profitable,
- permission for an AI agent to control capital directly,
- permission for the implementation model to activate mainnet by itself.

## 2.3 Core epistemic rule

No strategy, feature, model, parameter, venue, or execution policy is considered “good” merely because it looks intuitive or performs well on a backtest.

A candidate becomes production-eligible only by passing the required evidence gates.

---

# 3. Multi-Persona Design Review Mandate

The system shall be designed as though reviewed simultaneously by the following roles.

## 3.1 CEO

Questions the design must answer:

- Does the system have a realistic path to producing measurable value?
- What is the smallest practical MVP?
- What does success mean in 7, 30, 90, and 180 days?
- What kills the project?
- What is the capital-at-risk envelope?
- How does the system scale without changing its safety properties?

CEO acceptance condition:

> The roadmap has a measurable path from research to small real-capital operation and a clear reason to continue, pause, or terminate.

## 3.2 Quant

Questions the design must answer:

- What is the hypothesis?
- What stochastic process could create the edge?
- What is the conditional probability being estimated?
- How is uncertainty represented?
- Is the signal stable out-of-sample?
- How many hypotheses were tested?
- What is the multiple-testing penalty?
- Is the effect large enough after costs?

Quant acceptance condition:

> A candidate strategy has economically meaningful, statistically defensible, independently reproducible evidence.

## 3.3 Senior Engineer

Questions:

- Are boundaries explicit?
- Can any module bypass risk/execution controls?
- What happens on timeout, restart, duplicate message, schema drift, stale data, partial fill, or database failure?
- Is the system testable without exchange access?
- Are all state transitions deterministic and auditable?

Acceptance condition:

> Every externally observable failure mode has a defined state, action, retry policy, or terminal halt.

## 3.4 Architect

Questions:

- Can venues be added without rewriting strategy code?
- Can models be replaced without touching the execution kernel?
- Can research be separated from production?
- Which components are authoritative?
- What data is immutable?
- What state is derived versus source-of-truth?

Acceptance condition:

> Research, decision, risk, execution, venue, and operations are decoupled with explicit contracts.

## 3.5 Security Engineer

Questions:

- Can an AI/research component obtain a private key or signer?
- Can configuration be escalated from research to live trading?
- Can a compromised dependency submit a hidden order?
- Are secrets ever written to logs/database?
- Can one compromised process move or withdraw funds?

Acceptance condition:

> Minimum privilege, deny-by-default, auditable signing, and explicit human deployment gates are enforced.

## 3.6 Risk Manager

Questions:

- What is maximum loss per trade/day/system lifecycle?
- What happens when correlation or liquidity changes?
- What happens during data outages?
- What happens when the model becomes wrong?
- How quickly can risk be reduced?

Acceptance condition:

> Every risk trigger has a deterministic response and terminal safety state.

## 3.7 Trader / Execution Specialist

Questions:

- Will the order actually fill?
- At what queue position?
- What is adverse selection?
- What happens if the best price disappears?
- Are maker assumptions realistic?
- Are emergency exits feasible under poor liquidity?

Acceptance condition:

> Backtests and simulations model executable orders rather than fictional fills.

## 3.8 AI Researcher

Questions:

- Is the model discovering information or memorizing history?
- Is the AI allowed to select the test after seeing results?
- Are prompts/agents themselves introducing researcher degrees of freedom?
- Can AI-generated ideas be independently validated?

Acceptance condition:

> AI may accelerate hypothesis generation and analysis but cannot bypass statistical validation or deterministic risk/execution policy.

## 3.9 Investor

Questions:

- What evidence justifies adding capital?
- What evidence says to remove capital?
- Is the edge persistent?
- What is the downside distribution?
- Are returns dependent on one anomalous period?

Acceptance condition:

> Capital allocation is a consequence of evidence, not enthusiasm.

---

# 4. Constitutional Principles

These rules override optimization pressure.

## INV-01 — No guarantee claim

The system shall never represent expected profitability as guaranteed profitability.

## INV-02 — No trade is a valid decision

`NO_TRADE` is a first-class result, not an error.

## INV-03 — Unknown state outranks action

When exchange state is unresolved, the system must prefer reconciliation/halt to mutation.

## INV-04 — Exchange truth outranks local truth

Observed exchange state is authoritative for position/order status.

## INV-05 — AI cannot bypass safety

No AI agent may directly submit, cancel, resize, alter risk, or enable live trading.

## INV-06 — Capital scales only with evidence

Capital allocation cannot rise solely because the account made money.

## INV-07 — Strategy is not presumed valid

Every strategy starts as a hypothesis.

## INV-08 — Research results must be reproducible

A result without dataset, feature, parameter, code/version, cost-model, and experiment metadata is not production evidence.

## INV-09 — No hidden researcher degrees of freedom

Every materially tested candidate must be counted in the research ledger or explicitly declared outside the evaluation set.

## INV-10 — Production does not optimize itself silently

No automatic parameter fitting, model replacement, strategy replacement, or risk relaxation is allowed in live execution.

## INV-11 — Safety kernel remains deterministic

Research/model changes must not change mandatory execution/risk invariants unless a new specification revision is approved.

## INV-12 — Small first, scalable second

The first live scope should be intentionally narrow. Architecture must permit expansion without requiring initial complexity.

---

# 5. Scope Strategy

## 5.1 First live scope

Recommended initial production candidate:

- one venue,
- one liquid instrument,
- one strategy family,
- one small capital allocation,
- one deterministic risk policy,
- one execution policy.

BtcTurk is an acceptable first candidate for a TRY-denominated spot implementation, subject to live API/market verification and cost feasibility.

Hyperliquid remains the preferred initial derivatives execution candidate for the existing safety kernel.

## 5.2 Multi-venue policy

Multiple venues are allowed in the **data/research plane** before they are allowed in the execution plane.

Target architecture:

`BtcTurk + Binance + Hyperliquid + other supported sources`

→ unified market-data model

→ cross-venue research

→ alpha engine

→ venue-specific execution choice.

## 5.3 Venue role separation

A venue may be classified as:

- DATA_ONLY,
- RESEARCH_ONLY,
- PAPER_EXECUTION,
- TESTNET_EXECUTION,
- CANARY_EXECUTION,
- PRODUCTION_EXECUTION.

A venue cannot become PRODUCTION_EXECUTION without passing its own adapter and operational gates.

---

# 6. Reference System Architecture

```text
                         HYPER-QUANT v2.8

                ┌──────────────────────────┐
                │   AI / RESEARCH PLANE    │
                │                          │
                │ hypothesis generation   │
                │ feature research         │
                │ model research           │
                │ experiment analysis      │
                │ adversarial review       │
                └────────────┬─────────────┘
                             │ proposals only
                             ↓
                ┌──────────────────────────┐
                │  RESEARCH / VALIDATION   │
                │                          │
                │ data lake                │
                │ replay engine            │
                │ backtest                 │
                │ walk-forward             │
                │ PBO / DSR / tests        │
                │ execution simulation     │
                └────────────┬─────────────┘
                             │ approved strategy artifact
                             ↓
                ┌──────────────────────────┐
                │     DECISION PLANE       │
                │                          │
                │ feature engine           │
                │ regime engine            │
                │ probability model        │
                │ expected value           │
                │ opportunity score        │
                └────────────┬─────────────┘
                             │ ApprovedOrderIntent
                             ↓
                ┌──────────────────────────┐
                │       RISK ENGINE        │
                │                          │
                │ position sizing          │
                │ exposure limits          │
                │ liquidity limits         │
                │ daily / drawdown limits  │
                │ model confidence gates   │
                └────────────┬─────────────┘
                             │
                             ↓
                ┌──────────────────────────┐
                │ EXECUTION SAFETY KERNEL  │
                │                          │
                │ v1.5 state machine       │
                │ coordinator              │
                │ reconciliation           │
                │ kill switch              │
                │ audit journal            │
                └────────────┬─────────────┘
                             │
                             ↓
                ┌──────────────────────────┐
                │      VENUE ADAPTERS      │
                │ BtcTurk / HL / Binance… │
                └──────────────────────────┘
```

No module above the execution kernel may directly access credentials or mutation methods.

---

# 7. Safety Kernel Inheritance From v1.5

The following v1.5 behavior remains mandatory unless explicitly replaced by a future numbered amendment:

- isolated margin and maximum 2x leverage for the existing Hyperliquid first-perp implementation,
- dedicated account and separate signer,
- single physical mutation slot,
- durable intent before signing,
- unknown outcome → reconciliation,
- no local state treated as proof of flatness,
- no auto-resume,
- kill-switch state machine,
- structured redacted logs,
- secret non-persistence,
- exchange verification after mutations,
- partial-fill-aware position management,
- chaos testing,
- mainnet activation outside the authority of the coding model.

These are already specified in v1.5 and are retained as the safety baseline.

---

# 8. Data Plane

## 8.1 Data must be event-centric

The platform shall preserve raw or minimally transformed market events with:

- venue,
- instrument,
- event timestamp,
- receipt timestamp,
- sequence where available,
- event type,
- payload,
- schema version,
- source connection/session identifier.

## 8.2 Required data families

Where available:

- L1/BBO,
- L2 order book,
- trades,
- order-flow events,
- funding,
- open interest,
- liquidations,
- account orders,
- account fills,
- fees,
- exchange metadata,
- venue status,
- latency measurements.

## 8.3 Immutable data rule

Raw market data must be immutable after ingestion.

Corrections become new derived datasets rather than silently replacing historical data.

## 8.4 Timestamp discipline

Both exchange event time and local receive time must be retained whenever possible.

This is necessary to measure latency, lead/lag, stale data, and causality assumptions.

## 8.5 Current venue reality

BtcTurk documents public market data through its V2 endpoints and authenticated account/trading functions through V1, with WebSocket access and explicit rate-limit policies. Exchange metadata exposes tradable pairs and parameters such as price/quantity scales and `minExchangeValue`. Therefore venue metadata must be discovered dynamically rather than hardcoded.

Hyperliquid provides WebSocket market/account subscriptions including L2 and account-state related feeds, and supports isolated margin.

Binance provides authenticated WebSocket user-data streams and documents event ordering semantics for user events.

The adapters must therefore treat every venue as a versioned external dependency rather than assuming one universal API behavior.

---

# 9. Venue Adapter Contract

Every venue adapter must implement a common logical interface without pretending that venue semantics are identical.

```ts
interface VenueAdapter {
  getCapabilities(): Promise<VenueCapabilities>;
  getInstrumentMetadata(symbol: string): Promise<InstrumentMetadata>;
  getMarketSnapshot(symbol: string): Promise<MarketSnapshot>;
  subscribeMarketData(symbol: string): AsyncIterable<MarketEvent>;

  getAccountState(): Promise<AccountState>;
  getOpenOrders(symbol?: string): Promise<Order[]  >;
  getOrder(ref: OrderReference): Promise<Order | UnknownOrderState>;
  getRecentFills(window: TimeWindow): Promise<Fill[]>;
  getFees(): Promise<FeeSchedule>;

  submitOrder(intent: VenueOrderIntent): Promise<MutationOutcome>;
  cancelOrder(ref: OrderReference): Promise<MutationOutcome>;
}
```

The real SDK/API contract for each venue must be generated from current official documentation and locked by contract tests.

No undocumented endpoint may be substituted silently.

## 9.1 Venue Execution Profile

Every executable venue shall publish a versioned capability profile before any strategy is considered executable on that venue:

```text
venueId
apiVersion
marketType
orderTypes
postOnlySupport
reduceOnlySupport
conditionalOrderSupport
serverTimeSource
clientOrderIdempotency
positionSemantics
feeModel
minimumOrderConstraints
rateLimits
websocketSemantics
reconciliationCapabilities
```

A strategy's execution assumptions shall reference this profile by hash. A mismatch between the strategy artifact and current venue profile shall invalidate new orders until revalidated.

No order-type property, maker assumption, stop behavior, idempotency property, or fee rule may be inferred from another venue.

### 9.2 Venue switch rule

Changing the execution venue is a **new empirical environment**, even when the instrument is economically similar. Existing alpha evidence may inform research, but it shall not automatically authorize production execution on the new venue.

---

# 9.5 Canonical Intent State Machine

This section is the sole normative definition of execution intent lifecycle. Existing execution clauses shall reference this state machine rather than define alternative state names or transitions.

```text
INTENT_CREATED
    → DURABLE
    → RISK_AUTHORIZED
    → SIGNING
    → SUBMITTED
    → { CONFIRMED | UNKNOWN_REQUIRES_RECONCILIATION }
    → RECONCILING
    → { CONFIRMED | RECONCILIATION_FAILED }
```

Required rules:

1. No state may be skipped and no off-enum state may be constructed.
2. Each transition must be durably persisted before a subsequent mutation-bearing step is attempted.
3. `UNKNOWN_REQUIRES_RECONCILIATION` and `RECONCILIATION_FAILED` may never transition to a new mutation automatically.
4. The forbidden transitions `UNKNOWN_REQUIRES_RECONCILIATION → SUBMITTED`, `UNKNOWN_REQUIRES_RECONCILIATION → INTENT_CREATED`, and `UNKNOWN_REQUIRES_RECONCILIATION → FLAT_ASSUMED` are normative failures.
5. Exchange truth remains authoritative whenever the venue can still report state; local state must never infer flatness from absence of a local intent alone.

## 9.5.1 Commit boundary

A **commit boundary** is the exact handoff at which an already-finally-revalidated mutation is accepted by the mutation executor for remote submission under the exclusive physical mutation slot.

- Before the commit boundary: a kill, dependency-version change, risk-authorization change, execution-policy change, or expired authorization snapshot must cause deterministic `DENIED` and no remote mutation attempt.
- At the commit boundary: the mutation executor consumes a single-use authorization snapshot under the physical mutation slot. The executor shall not accept an expired, replayed, or version-mismatched snapshot.
- After the commit boundary: the mutation is classified `IN_FLIGHT`; the system must not claim zero remote mutation merely because a kill was raised afterward. Exchange reconciliation is mandatory.
- Kill activation after the commit boundary shall stop subsequent mutations but cannot retroactively prove that a remote request did not leave the process.
- Any ambiguous submission result is `UNKNOWN_REQUIRES_RECONCILIATION`, not `FAILED` or `CONFIRMED`.

The system therefore distinguishes **pre-handoff denial** from **post-handoff in-flight uncertainty**.

## 9.5.2 Versioned authorization snapshot

Every remote mutation requires an `AuthorizationSnapshot` containing:

```text
target_scope
kill_state_version
dependency_graph_version
risk_authorization_version
execution_policy_version
authorization_hash
expires_at_or_deadline
nonce
```

The snapshot is valid only while every version equals the current authoritative version, the target remains within its permitted scope, the deadline has not expired, no applicable kill is latched, and all hard risk constraints still pass. Final revalidation must re-check the same predicate immediately before the commit boundary.

A consumed snapshot is non-replayable. Reusing a consumed nonce is a deterministic authorization failure.

## 9.5.3 Minimum normative predicate

```text
MutationAllowed(target, snapshot) :=
    snapshot matches current versioned authorization state
    AND snapshot is unexpired
    AND snapshot is unconsumed
    AND NOT SystemKillActive
    AND NOT ApplicableHierarchicalKillActive(target)
    AND NOT ApplicableCrossCuttingKillActive(target)
    AND HardRiskLimitsPass(target)
    AND DependencyGraphCompatible(target)
    AND ExecutionPolicyCompatible(target)
```

The predicate must be evaluated from an authoritative, versioned state snapshot and must be revalidated before remote handoff.

## 9.6 Intent Persistence Contract

An intent record and its state transition must be persisted in one atomic durable unit (single transaction or equivalent durable-log append). Every intent has a caller-generated unique idempotency key.

Where the venue supports native idempotency, the adapter must propagate the key. Where the venue does not support it, the local key is only a correlation/reconciliation aid and shall not be described as duplicate prevention.

On restart, all non-terminal intents must be replayed or reconciled before any new intent for the affected instrument is admitted. A process restart may never silently convert uncertainty into a known failure or known confirmation.

Acceptance outcomes are explicitly:

`NOT_SUBMITTED_CONFIRMED` | `SUBMITTED_CONFIRMED` | `UNKNOWN_REQUIRES_RECONCILIATION`

The implementation must not manufacture a stronger outcome than the venue evidence supports.

## 9.7 v2.8 Executable Safety-Kernel Alignment

The v2.8 implementation is not permitted to weaken the v2.7 intent lifecycle by introducing an alternate execution state machine. The canonical state set is implemented by `src/execution/intent-state-machine.ts` and all transitions must pass the same transition table.

Every authorization snapshot shall carry `authorization_hash`, computed from a canonical serialization of target scope, all authorization versions, expiry, and nonce. Any tampering or reconstruction mismatch is a hard authorization failure.

Authorization expiry is evaluated against a fresh authoritative clock reading at every validation point. A caller-supplied timestamp may be used only to create a snapshot or deterministic test clock; it shall never suppress expiry validation after an asynchronous barrier.

The minimum executable authorization predicate is fail-closed: no mutation is authorized unless hard-risk, dependency-compatibility, execution-policy compatibility, scope-aware kill applicability, version equality, hash integrity, nonce freshness, and expiry checks all pass.

The coordinator must expose no test-only executor or barrier through the production entry point. Test determinism may control scheduler barriers only; it may never directly mutate authoritative safety state.

## 9.8 Durable Intent Journal and Reconciliation Contract

The v2.8 repository includes an append-only intent journal primitive. A journal entry contains the complete intent record and its previous state in one durable append unit, followed by `fsync()` before the append operation is acknowledged. This is the repository-level proof primitive for the v2.7 requirement for one atomic durable-log append; deployment-specific filesystem durability must still be validated before production authority.

A non-terminal intent is a hard admission blocker for a new intent on the same instrument until exchange reconciliation completes or a bounded reconciliation failure enters the explicit escalation lifecycle. Reconciliation retries are bounded; a transient unavailable response is not itself a terminal failure.

`UNKNOWN_REQUIRES_RECONCILIATION` may transition only to `RECONCILING`, and `RECONCILING` may transition only to `CONFIRMED` or `RECONCILIATION_FAILED`. No recovery path may silently re-submit the unknown intent.

## 39.1.1 v2.8 Kill Applicability Record

Kill state is represented as individually identifiable, scope-bearing activations. A hierarchical venue kill applies only to the declared venue, and a strategy kill applies only to the declared strategy within its declared venue. Cross-cutting data/model/research kills apply by explicit dependency/model/research identifiers.

The applicability predicate is evaluated against current target metadata on every authorization attempt; it is never cached from the moment a kill was raised. Kill activation and clearing monotonically advance `killStateVersion`.

## 40.5.2 v2.8 Adversarial Proof Additions

The mandatory execution-race suite now includes fresh-clock expiry after an asynchronous barrier, authorization-hash tampering, simultaneous scoped-kill matrix coverage, and explicit hard-risk/dependency/policy fail-closed cases. A successful test run without these assertions is insufficient to classify the execution-safety implementation as aligned with v2.8.

## 41.1.1 v2.8 Implementation Boundary

Passing v2.8 execution tests proves only the deterministic local safety-kernel contracts contained in this repository. It does not prove venue API correctness, signer isolation, durable database semantics, filesystem survival under host failure, exchange reconciliation against a live venue, or production portfolio-risk correctness. Those remain mandatory pre-production proof obligations.

# 10. Data Quality Engine

Every data stream gets a quality state:

```text
HEALTHY
DEGRADED
STALE
GAPPED
CROSSED
INCONSISTENT
UNAVAILABLE
```

The following decision matrix is normative:

| Data state | New signal | New-risk entry | Maintain/monitor existing position | Cancel/reconcile | Risk-reducing exit |
|---|---|---|---|---|---|
| HEALTHY | ALLOW | ALLOW if all other gates pass | ALLOW | ALLOW | ALLOW |
| DEGRADED | DENY | DENY | ALLOW | ALLOW | ALLOW with conservative policy |
| STALE | DENY | DENY | ALLOW using last verified exposure only | ALLOW | ALLOW if required safety inputs remain valid |
| GAPPED | DENY | DENY | ALLOW | ALLOW | ALLOW using safety path; otherwise HALT_WITH_EXPOSURE |
| CROSSED | DENY | DENY | ALLOW | ALLOW | ALLOW using independent safety snapshot |
| INCONSISTENT | DENY | DENY | ALLOW only for observation | ALLOW | ALLOW via verified emergency path |
| UNAVAILABLE | DENY | DENY | ALLOW only for passive monitoring | ALLOW | ALLOW only when sufficient independent exchange facts exist; otherwise HALT_WITH_POSSIBLE_EXPOSURE |

Every transition into a non-HEALTHY state must produce a durable event with source, timestamps, affected instruments, decision impact, and recovery evidence. A degraded stream may never silently become healthy without a fresh validation event.

Safety actions must generally have fewer data requirements than new-risk actions, but the system may never invent prices, positions, fills, or account states.

---

# 11. Feature Engine

The feature engine must be modular and versioned.

## 11.1 Price/return features

At multiple horizons where data supports them:

- log return,
- rolling return,
- volatility,
- realized variance,
- z-score,
- distance to rolling mean,
- VWAP distance,
- range position,
- acceleration/deceleration.

## 11.2 Microstructure features

Where L2/trade data exists:

- spread,
- relative spread,
- bid/ask depth,
- top-N depth,
- order-book imbalance,
- microprice,
- depth slope,
- trade imbalance,
- signed volume,
- trade intensity,
- order-flow imbalance,
- liquidity withdrawal/addition,
- book resiliency.

## 11.3 Cross-venue features

Where multiple venues cover the same instrument:

- price premium/discount,
- spread to reference venue,
- lead/lag,
- cross-venue return divergence,
- synchronized order-flow divergence,
- liquidity divergence,
- timing/latency relationship.

## 11.4 Derivatives features

Where applicable:

- funding,
- open interest,
- basis,
- liquidation intensity,
- mark/index divergence.

## 11.5 Feature governance

Each feature must have:

- `feature_id`,
- `version`,
- definition,
- units,
- lookback window,
- required data,
- missing-data behavior,
- leakage test,
- production computational cost.

No feature may use future information, future revisions, or data that was unavailable at decision time.

---

# 12. Market Regime Engine

The system shall not assume one strategy works in all regimes.

Initial regime taxonomy may include:

```text
MEAN_REVERSION_LOW_VOL
MEAN_REVERSION_HIGH_VOL
TREND_LOW_VOL
TREND_HIGH_VOL
LIQUIDITY_SHOCK
EVENT/ABNORMAL
UNKNOWN
```

Regime detection may initially be rule-based. More advanced models may be introduced later.

A strategy must declare its supported regimes.

A strategy operating outside its approved regime set must either:

- stop creating new entries, or
- use a formally validated alternate policy.

---

# 13. Alpha Research Layer

## 13.1 Strategy starts as hypothesis

Example hypothesis:

> “A short-horizon price dislocation accompanied by restoring order-flow pressure and sufficient liquidity has positive probability of reverting before a defined adverse move.”

This is a testable hypothesis, not an assumption of truth.

## 13.2 Initial strategy families

Research candidates may include:

1. short-horizon mean reversion,
2. momentum/breakout,
3. order-flow imbalance,
4. cross-venue lead/lag,
5. funding/basis behavior,
6. volatility expansion/contraction,
7. liquidity shock/reversion,
8. anomaly/event reaction.

Only one or a small number should be promoted for initial live deployment.

## 13.3 Canonical signal and decision contract

Strategy code shall output exactly one canonical `SignalIntent` schema. No second or legacy definition is permitted.

```ts
type SignalIntent = {
  schemaVersion: string;
  strategyId: string;
  strategyVersion: string;
  generatedAt: string;
  decisionTimestamp: string;
  instrument: string;
  direction: "LONG" | "SHORT" | "NONE";
  horizonMs: number;
  predictedReturn?: Decimal;
  probability?: Decimal;
  confidence?: Decimal;
  regimeId: string;
  featureSnapshotHash: string;
  marketSnapshotHash: string;
  modelArtifactHash?: string;
  reasonCodes: string[];
};
```

A signal cannot send an order.

### 13.4 Type-level decision contract

The boundary between research, decision, capital, risk, and execution is normative:

```ts
type ApprovedOrderIntent = {
  schemaVersion: string;
  signal: SignalIntent;
  venueId: string;
  capitalPolicyVersion: string;
  riskPolicyVersion: string;
  riskBudget: Decimal;
  quantity: Decimal;
  limitPrice?: Decimal;
  expectedNetEV: Decimal;
  expectedRisk: Decimal;
  executionPolicyId: string;
  portfolioRiskHash: string;
  approvalHash: string;
  expiresAt: string;
};
```

Only the Risk Engine may construct `ApprovedOrderIntent`. The Execution Safety Kernel accepts only this artifact and may additionally reject it for safety, freshness, state, venue-capability, or expiry reasons.

### 13.5 Normative upper-plane result contracts

All upper-plane services shall expose typed, versioned result envelopes. A service may not return an untyped boolean such as `true/false` for a safety-relevant decision.

```ts
type DataHealth =
  | "HEALTHY"
  | "DEGRADED"
  | "STALE"
  | "GAPPED"
  | "CROSSED"
  | "INCONSISTENT"
  | "UNAVAILABLE";

type ResearchDecision = {
  schemaVersion: string;
  strategyId: string;
  strategyVersion: string;
  artifactHash: string;
  status: "ELIGIBLE" | "INELIGIBLE" | "BLOCKED";
  reasons: string[];
};

type RiskDecision = {
  schemaVersion: string;
  status: "APPROVED" | "NO_TRADE" | "BLOCKED";
  riskPolicyVersion: string;
  portfolioRiskHash: string;
  reasons: string[];
  evaluatedAt: string;
};
```

Cross-version compatibility is deny-by-default. A producer and consumer with mismatched major schema versions must not trade until compatibility is explicitly approved and tested.

---

# 14. Probability Engine

## 14.1 Replace unconditional historical hit-rate with conditional estimation

The core probability should be conceptually:

`P(TP_before_SL | current_market_state, strategy, horizon, regime)`

rather than merely:

`wins / total trades`.

The historical win rate may remain as a baseline estimator, but it must not be treated as the complete forecasting model.

## 14.2 Model hierarchy

Use the simplest adequate model first:

- calibrated logistic regression,
- generalized linear models,
- tree-based models,
- gradient boosting,
- Bayesian models,
- neural models only when justified by data and validation.

No model is favored because it is more sophisticated.

## 14.3 Probability calibration

Predicted probabilities must be evaluated with calibration metrics and may use formally validated calibration layers.

Required reporting should include:

- Brier score,
- calibration curve,
- reliability by probability bucket,
- confidence interval/uncertainty estimate,
- out-of-sample performance.

## 14.4 Model uncertainty

The model must be able to say:

`INSUFFICIENT_CONFIDENCE`

and this is equivalent to `NO_TRADE` for new-risk decisions.

---

# 15. Expected Value Engine

Every candidate must be evaluated net of realistic costs.

Conceptually:

`NetEV = ExpectedGrossPnL - fees - spread - slippage - adverseSelection - expectedFunding - otherKnownCosts`

The model must separate:

- expected winner payoff,
- expected loser payoff,
- probability of each path,
- execution probability,
- expected time in market.

The previous v1.5 fixed-Kelly assumption (`b = 2.0`) must not be treated as universal.

For each candidate:

`b = expected net win / expected net loss`

where both are derived using the actual target, stop, fees, and validated execution assumptions.

Fractional Kelly may then be used as one input to sizing, but never overrides hard risk limits.

### 15.1 Payoff-ratio uncertainty stress

The payoff ratio `b` shall never be treated as a point estimate without uncertainty. Before Kelly contributes to sizing, the system shall compute a declared uncertainty interval or stress grid for `b` using only information available in the training/validation boundary.

Sizing shall use the **conservative stressed payoff ratio**, not the most favorable estimate. The strategy artifact shall report: point `b`, uncertainty/stress range, method, effective sample size, and resulting sizing sensitivity.

If the conservative `b` or its uncertainty cannot be estimated defensibly, Kelly contribution shall be zero and the risk engine shall size only from non-Kelly limits.

---

# 16. Opportunity Representation

The platform shall not contain an undefined scalar scoring function in a safety-relevant path.

A candidate decision shall expose a **typed opportunity vector** containing, at minimum:

```text
alpha_estimate
calibrated_probability
expected_return
expected_net_ev
regime_fit
liquidity_state
execution_probability
expected_cost
model_uncertainty
risk_budget_usage
```

A scalar `OpportunityScore` is optional and non-authoritative. If a score is used for ranking, capital prioritization, experiment selection, or strategy comparison:

- its formula and weights shall be explicitly declared before the evaluation window;
- its formula/version shall be included in the research artifact and ledger;
- changing the formula or weights after observing evaluation results shall create a new research trial;
- the score shall never bypass mandatory risk, venue, freshness, or execution gates.

No implementation agent may invent the weighting function silently.

# 17. Execution Modeling

Backtesting must not assume fictional fills.

## 17.1 Required variables

Where data allows:

- order arrival latency,
- queue position,
- order-book state at arrival,
- trade flow after order arrival,
- cancellations ahead of the order,
- partial fills,
- price movement during queue time,
- maker/taker fee,
- adverse selection,
- emergency exit impact.

## 17.2 Maker fill model

For a post-only order, the simulator shall estimate:

`P(fill within T | queue, trade flow, cancellations, liquidity, latency)`

rather than granting immediate fill at displayed price.

## 17.3 Taker/emergency model

Marketable or emergency execution shall use a depth/impact model and shall represent partial-fill outcomes wherever the venue/data model permits them. If partial-fill behavior cannot be modeled, the affected result is ineligible for promotion.

## 17.3.1 Stop-protection hierarchy

A software-managed stop remains an operationally fragile last-resort mechanism. Where a venue provides an exchange-side conditional/stop mechanism that is documented, permissioned, and contract-tested, the production policy shall prefer a validated exchange-side protective order over a software-only trigger.

If no validated exchange-side protection exists, the strategy artifact must explicitly record the residual unattended-process risk and pass a stricter operational-risk review before live capital.

For `SOFTWARE_STOP_ONLY`, the canary policy shall additionally define a **maximum unattended-loss exposure** in currency and as a percentage of verified equity. The system shall size the canary to the smaller of capital, liquidity, strategy-risk, and unattended-loss limits. A percentage-of-allocation cap alone is not sufficient.'

## 17.4 Execution quality metrics

Measure:

- fill rate,
- time-to-fill,
- maker-to-taker conversion,
- adverse selection,
- realized slippage,
- expected vs realized spread cost,
- queue survival,
- cancellation rate.

---

# 18. Event-Driven Replay Engine

The platform shall include a deterministic historical replay engine.

Input:

- market events,
- account events where necessary,
- funding events,
- known fees,
- system latency assumptions,
- strategy/model version.

Output:

- signals,
- simulated orders,
- simulated fills,
- position path,
- PnL path,
- costs,
- drawdown,
- risk events,
- strategy state.

Replay must preserve event order and decision-time information constraints.

---

# 19. Backtesting Standard

A backtest result without an execution model is incomplete evidence for short-horizon strategies.

Every published result must specify:

- dataset period,
- venue,
- symbol,
- data frequency,
- market data type,
- transaction-cost model,
- slippage model,
- latency assumption,
- fill model,
- funding treatment,
- position sizing,
- capital starting point,
- all strategy parameters,
- code commit/hash,
- number of research trials that preceded selection.

---

# 20. Anti-Overfitting Framework

This section is mandatory.

The system shall assume that excessive strategy search can create attractive but non-generalizable historical performance. Research on backtest overfitting specifically motivates estimating the probability that a selected backtest is overfit and accounting for the number of alternatives tested.

## 20.1 Research ledger

Every materially tested candidate must be recorded.

Required fields:

```text
experiment_id
strategy_family
strategy_version
feature_set_hash
parameter_set_hash
data_hash
train_period
validation_period
oos_period
execution_model_version
number_of_trials_seen_so_far
result_summary
promotion_status
```

## 20.2 Validation structure

Use, where statistically appropriate:

- train/validation/test separation,
- walk-forward evaluation,
- purged validation for overlapping labels,
- embargo periods when required by label leakage structure,
- out-of-sample holdouts,
- regime-specific evaluation.

## 20.3 Multiple-testing controls

The research framework shall support and, where applicable to the selected evaluation design, shall execute:

- PBO/CSCV analysis,
- Deflated Sharpe Ratio,
- multiple-testing adjustment,
- parameter stability analysis,
- dependence-aware effective sample size estimation,
- false-discovery controls for family-level and model-level selection.

PBO/CSCV has been proposed specifically for estimating the probability that an investment backtest is over-fit.

## 20.4 Freeze rule

Once a candidate enters final out-of-sample evaluation, its strategy code, features, parameters, cost assumptions, and model-selection criteria are frozen.

No “small improvement” may be made against the final test set without creating a new experiment lineage.

## 20.5 AI research accounting

AI-generated strategy ideas count as research trials.

The ledger must also record the agent/model identifier, prompt or prompt-hash, tool configuration, proposal lineage, and whether the proposal was derived from a previously observed result. AI-generated trial volume must be included in multiple-testing accounting. An agent is not allowed to hide failed or discarded variants from the research ledger.

Prompt variants, feature suggestions, model variants, or human changes that materially alter the candidate must be tracked where they influence selection.

## 20.6 Family-level and portfolio-of-hypotheses accounting

The research ledger shall maintain multiplicity not only within a strategy, but across the **entire search program**. Strategy-family selection, venue selection, feature-family selection, model-family selection, labeling choices, and execution-policy selection are themselves research decisions when they are informed by observed results.

At the start of each research program the system shall declare a search registry containing:

```text
research_program_id
allowed_strategy_families
allowed_venue_families
allowed_feature_families
allowed_model_families
selection_policy_version
trial_budget_policy_version
```

The research program shall also pre-declare an allocation of research trials or compute budget across the permitted strategy families before comparative evaluation begins. Family-level selection criteria shall be frozen before the family comparison window.

A family selected after observing comparative results shall carry the full upstream search lineage into the multiple-testing record. It may not be treated as a new independent test universe.

The final production candidate shall not be selected solely because it has the highest observed PnL, Sharpe, hit rate, or OpportunityScore among tested families. Selection must satisfy the pre-declared promotion policy and independent robustness evidence.

## 20.7 Write-before-run research enforcement

Every empirical research execution shall receive a durable `ResearchTrialReceipt` **before compute begins**. The receipt shall contain:

```ts
type ResearchTrialReceipt = {
  trialId: string;
  researchProgramId: string;
  hypothesisId: string;
  codeHash: string;
  configHash: string;
  datasetHash: string;
  selectionPolicyHash: string;
  parentTrialIds: string[];
  createdAt: string;
};
```

The approved research runner shall refuse to execute an empirical job without a valid receipt. The receipt and terminal outcome shall be durably committed even when the run crashes, times out, or fails before producing a result.

The research runner shall be the only approved entry point for controlled experiments in the evaluation environment. Direct ad-hoc execution of evaluation code outside the runner is not part of the validated evidence set and shall invalidate that run for promotion.

The purpose is to implement for research the same discipline used by the execution kernel: **record intent before mutation/compute**.

---

## 20.7.1 Executable Feature Dependency Derivation

Before empirical compute is permitted, the research pipeline shall generate a feature dependency manifest from the actual executable feature path. A researcher-supplied lookback is documentation only and cannot reduce the derived dependency bound.

The purge window shall be computed as:

`purge_window = label_horizon + max_extracted_lookback`

A declared lookback smaller than the extracted bound is a hard research-integrity failure and blocks compute. If static or dynamic dependency extraction cannot produce a sound finite upper bound, compute is blocked and `RESEARCH_INTEGRITY_KILL` is raised; human sign-off may not bypass this gate.

The dependency manifest, extraction tool version, analysis configuration, and resulting purge/embargo parameters are themselves hashed into the trial identity chain.

## 20.8 Executable Artifact and Dependency Identity Binding

Every empirical trial shall bind its durable `ResearchTrialReceipt` to an immutable execution identity chain:

```text
ResearchTrialReceipt
  → source_tree_hash
  → artifact_hash
  → manifest_hash
  → dependency_lock_hash
  → dependency_graph_hash
  → build_environment_hash
  → executable_artifact_hash
```

The registered identity chain and the executed artifact must match exactly at runtime. Any mismatch is `EXECUTION_DENIED` and raises a `RESEARCH_INTEGRITY_KILL`-class incident. A post-registration source, dependency, build-environment, or executable mutation requires a new immutable artifact identity and a new trial receipt.

A dependency whose effective runtime identity cannot be deterministically declared and bounded must fail closed; human approval may not bypass the compute gate.

The artifact identity chain must be stored with the terminal result and remain independently verifiable.

## 20.9 Research Evaluation Budget Hierarchy

Holdout access is governed by a non-resettable hierarchy:

`RESEARCH_PROGRAM → GLOBAL_HOLDOUT_BUDGET → FAMILY_HOLDOUT_BUDGET → LINEAGE_HOLDOUT_BUDGET`.

The global budget is a lifetime monotonic accumulator for the governed research program root identity. Family and lineage consumption can never exceed their upper budgets or replenish consumed allocation. Creating a new strategy family, lineage, or policy version may not erase prior consumption. Extensions must increase the declared lifetime total and require a versioned research-policy amendment before additional evaluation access is granted.

The family taxonomy and a non-recreatable research-program root identity must be established before empirical outcomes are observed. Researcher-controlled renaming, family splitting, or program recreation must not create fresh holdout budget. Program identity continuity must be anchored in an immutable governance record rather than only in a researcher-supplied string.

Every evaluation consumes budget regardless of whether the result is favourable, unfavourable, or inconclusive.

## 20.10 Holdout Isolation and Oracle Access

Final holdout data shall be technically inaccessible to ordinary research execution. No research credential, process, filesystem mount, environment variable, database role, notebook kernel, artifact store path, IPC endpoint, or output channel may provide direct holdout observation.

Evaluation APIs shall expose only predeclared result classes sufficient for the evaluation contract. A research process must not receive raw holdout rows, feature dumps, labels, timestamps, or adaptive oracle detail merely to decide whether to continue searching.

The evaluation boundary is lineage-aware and family-aware and is additionally constrained by the global lifetime budget in §20.9.

# 21. Statistical Acceptance Standard

A strategy shall not be promoted using an unspecified future threshold. The project therefore defines **baseline governance gates** below. These are conservative defaults for the first research program; any change requires a new versioned research-policy artifact and may not be tuned against the final holdout.

## 21.1 Mandatory evidence layers

A candidate must separately pass:

1. data integrity and leakage checks,
2. deterministic replay reproducibility,
3. realistic execution-cost simulation,
4. out-of-sample evaluation,
5. walk-forward evaluation,
6. regime decomposition,
7. multiple-testing / overfitting analysis,
8. shadow execution comparison,
9. testnet operational verification before real capital.

## 21.2 Baseline quantitative promotion gates

Unless a stricter strategy-specific policy exists, promotion from research to shadow requires all of the following:

- out-of-sample net expectancy > 0 after modeled costs,
- the lower bound of the pre-declared confidence interval for mean trade expectancy is > 0 where the estimator assumptions permit it; otherwise an approved distribution-free equivalent must be used,
- Deflated Sharpe Ratio >= 0.95 under the declared multiple-testing specification, or an independently justified equivalent confidence standard; the DSR input trial count shall come from the committed research ledger rather than analyst self-report,
- PBO/CSCV < 0.10 or a documented statistically defensible equivalent for the tested design,
- the promotion report shall include sensitivity to the DSR/PBO assumptions and shall not rely on a single diagnostic in isolation,
- no single contiguous evaluation block may contribute more than 50% of total net PnL,
- at least 3 materially different market regimes represented in the evaluation set when the selected market has such regimes;
- effective out-of-sample sample size (after overlap/dependence adjustment) >= 200 decision opportunities; raw trade count is not a substitute,
- no single calendar week may account for more than 50% of total net PnL unless the strategy is explicitly event-driven and its scope declares this dependency,
- execution-adjusted results remain positive under a conservative cost stress of at least 1.5x modeled variable execution cost and the strategy-specific stress defined in its artifact,
- maximum drawdown and tail loss remain inside the approved strategy risk policy,
- all material research trials are present in the ledger.

These are promotion gates, not claims of statistical certainty. A strategy may still fail in live markets.

## 21.3 Minimum sample policy

No single universal trade count is treated as proof. Each strategy must declare a minimum effective sample based on its label frequency, dependence structure, horizon, and variance. As a default starting constraint, fewer than 200 independent or appropriately de-overlapped out-of-sample decision opportunities is insufficient for production promotion; the effective-sample calculation must be reproducible from the labeled event stream. This threshold may be increased, never silently decreased, through a research-policy amendment.

## 21.4 Production gate tightening

Promotion from shadow/canary to controlled production requires stronger evidence than research-to-shadow. The production policy shall additionally require:

- stable performance across at least two independent out-of-sample periods,
- no material unexplained difference between simulated and observed fill/slippage behavior,
- calibration error within the model artifact's declared bound;
- declared statistical power / minimum detectable effect analysis supports the promotion decision,
- no unresolved P0/P1 defect,
- no unresolved state/reconciliation incident,
- successful adversarial review.
# 22. Minimum Evidence Principle

The system shall not use an arbitrary rule such as “100 trades means profitable” as the sole proof of an edge.

The v1.5 requirement for 100 qualified testnet trades remains useful as an **operational history gate**, but it is not a statistical proof by itself.

Promotion must consider:

- sample size,
- independent periods,
- distribution of outcomes,
- stability across regimes,
- execution realism,
- research trial count,
- confidence/uncertainty,
- drawdown behavior.

---

# 22.5 Decision / Research Failure State Contract

Failures in upper-plane components must not leak into uncontrolled execution behavior.

```text
RESEARCH_AVAILABLE
RESEARCH_DEGRADED
FEATURES_UNAVAILABLE
MODEL_UNAVAILABLE
MODEL_MISMATCH
REGIME_UNKNOWN
DECISION_STALE
APPROVAL_INVALID
```

Normative actions:

- `RESEARCH_DEGRADED` → existing approved production artifacts may continue; no new strategy promotion.
- `FEATURES_UNAVAILABLE` → `NO_NEW_RISK`.
- `MODEL_UNAVAILABLE` → `NO_NEW_RISK`; existing positions follow risk-reduction policy.
- `MODEL_MISMATCH` → immediate `NO_NEW_RISK` and alert; production artifact must be revalidated.
- `REGIME_UNKNOWN` → no entry unless the strategy explicitly declares `UNKNOWN` as validated.
- `DECISION_STALE` → no new order; existing positions remain under safety monitoring.
- `APPROVAL_INVALID` → reject the order intent and alert.

A failure of the research plane must never cause the execution kernel to invent a fallback strategy.

# 23. Risk Engine

## 23.0 Risk aggregation is mandatory

Even before multi-strategy execution is enabled, the Risk Engine must use an aggregate risk ledger capable of representing correlated strategies, shared instruments, shared venues, and shared capital.

For each strategy, venue, instrument, and portfolio bucket, maintain:

```text
current_exposure
max_exposure
expected_loss
stressed_loss
liquidity_usage
model_uncertainty
correlation_bucket
capital_allocation
```

Portfolio permission is the minimum of all applicable limits. A strategy may not justify a trade by looking only at its own local risk budget.

## 23.0.1 Initial restriction

The first live deployment shall still use one strategy and one instrument. The aggregate framework exists from the start so that later expansion does not require replacing the risk model.

## 23.1 Hard limits

Hard risk limits must be deterministic and immutable at runtime for production.

Examples include:

- maximum risk per trade,
- maximum open exposure,
- maximum daily loss,
- maximum drawdown,
- maximum consecutive losses,
- maximum capital allocation per strategy,
- maximum venue exposure,
- maximum liquidity utilization,
- maximum strategy/model uncertainty.

## 23.2 Dynamic risk allocation

Dynamic allocation is allowed only inside pre-approved bounds.

General form:

`approvedRisk = min(baseRisk, KellyFractionalRisk, liquidityRisk, modelConfidenceRisk, drawdownRisk, venueRisk)`

## 23.3 Risk reduction mode

When edge confidence falls but the account is already exposed:

`NO_NEW_RISK`

must be separated from:

`REDUCE_EXISTING_RISK`.

## 23.4 Strategy degradation

A strategy may be disabled independently of the whole platform.

### 23.4.1 Consecutive-loss escalation

A strategy shall not enter an indefinite `cooldown → resume → cooldown` loop without escalation. The risk engine shall maintain a durable strategy-loss escalation counter.

Default policy for an approved strategy:

```text
first max_consecutive_losses breach
  → COOLDOWN

second breach before a new independently validated performance window
  → STRATEGY_KILL
  → no new entries
  → manual review required

STRATEGY_KILL
  → remains disabled until a new promotion/re-enable decision
```

The exact counting window and thresholds shall be versioned in the risk policy. A restart must not reset the counter.

Triggers can include:

- statistically significant performance deterioration,
- persistent negative expectancy,
- unexpected slippage,
- fill-rate collapse,
- feature drift,
- regime mismatch,
- calibration deterioration,
- infrastructure instability.

---

## 23.5 Hard Exposure Dimensions

`approvedRisk` is necessary but not sufficient. Mutation authorization must independently evaluate:

- approved capital,
- allocated capital,
- deployed/committed capital,
- gross exposure,
- net exposure,
- margin utilization,
- liquidity utilization / liquidation-at-risk,
- concentration exposure,
- correlation-adjusted aggregate risk, and
- tail-loss constraints.

Unknown correlation, unknown liquidity capacity, or uncertain cross-strategy exposure shall not weaken a hard limit; the conservative response is to block or reduce the proposed mutation. Existing positions remain governed by their actual deployed exposure and are never silently re-sized merely because a higher promotion level was approved.

# 24. Model Drift / Strategy Drift

Track at least:

- feature-distribution drift,
- prediction-distribution drift,
- probability calibration drift,
- realized-vs-expected PnL,
- realized-vs-expected slippage,
- fill-rate drift,
- regime-frequency drift.

A materially degraded strategy must enter:

`STRATEGY_DEGRADED → NO_NEW_ENTRIES → REVIEW`

unless a previously validated degradation policy exists.

---

# 25. Capital Allocation Engine

This is the mechanism that operationalizes the “500 → larger capital” idea without turning it into martingale logic.

## 25.1 Capital states

```text
RESEARCH
PAPER
SHADOW
TESTNET
CANARY
LEVEL_1
LEVEL_2
LEVEL_3
...
```


### 25.1.1 Capital accounting identities

The system shall distinguish: `APPROVED_CAPITAL` (policy ceiling), `ALLOCATED_CAPITAL` (assigned to a strategy/program and ≤ approved), and `DEPLOYED_CAPITAL` (actually committed/reserved and ≤ allocated). Capital promotion does not imply immediate deployment, and deployment cannot exceed either upstream limit.

## 25.2 Promotion

A strategy shall increase capital only when all required gates pass.

Example gate categories:

- positive OOS expectancy,
- acceptable drawdown,
- execution stability,
- no unresolved safety incident,
- regime coverage acceptable,
- model calibration acceptable,
- live/shadow behavior consistent with research,
- sufficient independent observations.

## 25.3 Demotion

Capital allocation must decrease when:

- drawdown enters predefined bands,
- edge confidence weakens,
- realized execution cost exceeds validated bound,
- strategy drift is detected,
- venue reliability degrades,
- statistical evidence becomes insufficient.

## 25.4 No doubling rule

The system must never use:

`loss → increase size`

as its normal capital allocation rule.

---

# 26. First-Value / MVP Plan

The project must produce measurable evidence quickly without prematurely building every advanced component.

## MVP-0 — Market Feasibility

One venue + one liquid market + live public market data + fee/precision discovery.

Deliverable:

`minimum viable capital report`

containing:

- minimum order size,
- fees,
- spread,
- observed volatility,
- expected cost per round trip,
- capital required to produce economically meaningful edge.

For BtcTurk specifically, current official documentation exposes pair scales, order methods and minimum exchange value through `exchangeInfo`, so this calculation must be dynamic.

## MVP-1 — Data Recorder

Record market data for reproducible research.

## MVP-2 — Baseline Strategy

One deliberately simple strategy, initially likely short-horizon mean reversion or another hypothesis chosen after data analysis.

Before backtest promotion, the strategy must declare its required execution capabilities. A strategy requiring `post_only`, `reduce_only`, or any venue-specific behavior cannot run against a venue lacking that capability.

## MVP-3 — Replay + Cost-Aware Backtest

No live capital yet.

## MVP-4 — Shadow Mode

Real market data, real decisions, no order submission.

## MVP-5 — Testnet / Paper

Full execution path.

## MVP-6 — Tiny Real Capital

Only after all production gates pass.

The purpose of the first live deployment is **not maximum return**.

It is to verify that expected alpha survives:

`real market + real fees + real latency + real execution + real operations`.

---

# 27. Candidate First Strategy

The first strategy shall not be frozen by assumption.

However, the current baseline hypothesis inherited from v1.5 is:

- long-only mean reversion,
- short-horizon price dislocation,
- volatility filter,
- momentum filter,
- liquidity/execution filter.

The v1.5 z-score framework is retained as a **baseline hypothesis**, not as a known profitable strategy.

The research engine must attempt to falsify it.

A better strategy replaces it only after evidence demonstrates superiority without uncontrolled research leakage.

---

# 28. Baseline vs Advanced Research

## Baseline

- rolling z-score,
- realized volatility,
- momentum,
- spread,
- order-book depth,
- expected cost.

## Advanced

- conditional probability models,
- regime models,
- order-flow models,
- cross-venue lead/lag,
- execution fill models,
- Bayesian uncertainty,
- ML models.

The advanced system is not considered successful until it beats the baseline **out-of-sample and after costs**, not merely on training data.

---

# 29. AI Governance

## 29.1 AI can

- generate hypotheses,
- suggest features,
- inspect experiment results,
- propose model classes,
- write research code subject to tests,
- explain failures,
- conduct adversarial review,
- generate documentation.

## 29.2 AI cannot

- access secrets,
- create or approve a live signer,
- withdraw funds,
- modify production risk limits,
- enable live trading,
- bypass validation,
- suppress audit records,
- erase failed experiments,
- redefine a success criterion after seeing the result.

## 29.3 AI proposal protocol

Every AI-generated hypothesis receives a unique `hypothesis_id` before any empirical test. The record must include:

- source type (`AI`, `HUMAN`, `HYBRID`);
- originating model/agent identifier and model version where available;
- prompt or task specification hash where policy permits recording it;
- feature/parameter search space;
- parent hypothesis IDs;
- timestamp;
- dataset snapshot hash;
- outcome and rejection/selection decision.

All AI-generated hypotheses count toward the same multiple-testing and researcher-degrees-of-freedom ledger as human-generated hypotheses. AI hypotheses are **not** granted a separate testing allowance and may not bypass the trial count by changing prompts, model versions, or experiment wrappers. Parent/child variants remain linked and count as additional trials when their empirical specification differs materially.

Seeing a result does not permit retroactive modification of the hypothesis record. Any post-result change creates a new hypothesis and a new trial.

The AI research layer may propose, analyze, reproduce, and review; it may not promote itself. Promotion requires deterministic reproduction plus an independent review decision.

## 29.4 Technical isolation

The architectural prohibition on direct AI execution must be enforced technically, not only contractually.

Research/AI workloads shall run in a separate process or isolated runtime boundary with:

- no access to signing keys,
- no route to exchange mutation endpoints, enforced by network policy rather than application convention alone,
- no permission to modify live risk configuration,
- read-only access to approved research datasets,
- write access only to a controlled research-artifact store,
- egress restricted to explicitly approved research services,
- filesystem permissions preventing access to production secrets, databases, and journals,
- immutable audit of every proposal and artifact write.

The production executor must run with a deny-by-default network policy permitting only the minimum venue and observability endpoints needed for its declared function.

The production execution environment must not execute arbitrary AI-generated code, prompts, notebooks, or model files. A promotion pipeline must convert a reviewed research artifact into a signed/hashed production artifact before the production environment can load it.

Any research artifact containing executable content must pass dependency, malware, sandbox, and reproducibility checks before it can enter the promotion pipeline.

```text
AI Proposal
→ Experiment Record
→ Deterministic Reproduction
→ Validation
→ Independent Review
→ Promotion Gate
```

---

# 30. Independent Review Framework

The Master Spec is intended to be submitted to independent AIs, quant researchers, architects, security engineers, and senior developers.

Each reviewer must produce:

1. assumptions found,
2. contradictions found,
3. missing requirements,
4. false precision or arbitrary thresholds,
5. hidden failure modes,
6. statistical weaknesses,
7. execution realism issues,
8. security weaknesses,
9. architectural weaknesses,
10. recommendations ranked by severity.

Reviewers must distinguish:

`BLOCKER / P0 / P1 / P2 / ENHANCEMENT`

rather than making unstructured comments.

---

# 31. Adversarial Review Questions

Independent reviewers should attempt to break the proposal by asking:

## Quant

- Can the alpha survive a different market period?
- Can it survive fees doubled?
- Can it survive spread doubled?
- Can it survive latency doubled?
- Does the edge disappear after controlling for the number of experiments?
- Is the label definition leaking information?
- Was strategy-family selection itself treated as multiple testing?
- Can an experiment run without a committed pre-run receipt?
- Can the ledger truthfully account for failed compute jobs and crashed research processes?
- Does the DSR conclusion materially change under plausible trial-count assumptions?
- Does the payoff-ratio/ Kelly sizing remain bounded under pessimistic b assumptions?

## Trader

- Would the order actually fill?
- Is the fill assumption unrealistic?
- Is the “maker” strategy actually adverse-selection dominated?
- Can emergency liquidation happen under thin depth?

## Risk

- What happens after 5/10/20 consecutive losses?
- What happens if liquidity disappears?
- What happens if the venue freezes?
- What happens if equity is wrong or stale?

## Security

- Can a compromised package obtain the signer?
- Can a research process reach the mutation layer?
- Can Telegram or another alert channel become an execution command path?

## Architecture

- Can one adapter be swapped without changing strategy code?
- Can data schema changes silently corrupt the model?
- Can a restart recreate inconsistent state?

## CEO / Investor

- What evidence causes “invest more”?
- What evidence causes “invest less”?
- What evidence causes “terminate this strategy”?
- How much capital can the system lose before shutdown?

---

# 32. Operational State Model

The system shall preserve separate state dimensions.

```text
System State
Data Health
Strategy State
Risk State
Execution State
Venue State
Capital Allocation State
```

Example:

```text
System = READY
Data = HEALTHY
Strategy = ACTIVE
Risk = NORMAL
Execution = IDLE
Venue = HEALTHY
Capital = CANARY
```

Another example:

```text
System = RUNNING
Data = HEALTHY
Strategy = DEGRADED
Risk = NO_NEW_RISK
Execution = MANAGING_POSITION
Venue = HEALTHY
Capital = REDUCED
```

This prevents one giant enum from hiding materially different states.

---

# 33. Research Artifact Standard

Every promoted strategy must have a complete artifact:

```text
strategy_id
strategy_version
code_hash
config_hash
feature_manifest
model_hash
training_dataset_hash
validation_dataset_hash
oos_dataset_hash
execution_model_hash
research_trial_count
statistical_report
risk_report
security_report
review_report
promotion_decision
```

A production process must be able to answer:

> “Exactly what strategy did we run, with what data, assumptions, model, risk rules, and code?”

---

# 34. Production Observability

Required real-time observability includes:

- connectivity,
- data freshness,
- venue health,
- orders,
- fills,
- position,
- realized PnL,
- expected PnL,
- slippage,
- fees,
- funding where applicable,
- risk state,
- strategy state,
- capital allocation state,
- model confidence,
- drift indicators.

No dashboard is permitted to become a source of truth over the exchange/account system.

---

# 35. Security Architecture

## Mandatory controls

- separate account/signer identities where the venue supports them,
- secret source external to repository,
- least privilege,
- no withdrawal permission for trading signer where configurable,
- IP restrictions where supported,
- production credentials separated from test credentials,
- encrypted secret storage outside application DB,
- structured log redaction,
- dependency lockfile,
- dependency scanning,
- reproducible builds,
- signed release artifacts where practical,
- production deploy approval separate from coding agent.

NIST's SSDF emphasizes integrating secure software practices into the SDLC rather than treating security as a final-stage check. This specification adopts that philosophy.

---

# 36. Dependency / API Governance

The project shall pin direct dependencies and maintain lockfiles for reproducibility.

Hyperliquid SDK compatibility must be verified at implementation time. The previously frozen v1.5 version was `@nktkas/hyperliquid 0.33.0`; current upstream release history shows later versions, including 0.33.2, and the current repository reports 0.33.3. Therefore the implementation must not assume that the old version remains current; it must explicitly choose and contract-test an approved exact version before build.

No automatic dependency upgrade is permitted.

---

# 37. Venue-Specific Notes

## BtcTurk

Treat current API documentation as authoritative during adapter implementation.

Important operational facts to verify dynamically:

- trading symbol status,
- price scale,
- quantity scale,
- minimum exchange value,
- supported order methods,
- fee schedule,
- account permissions,
- rate limits,
- WebSocket health/reconnection behavior.

BtcTurk documents rate limits and a maximum of 15 WebSocket connection requests per minute; therefore reconnect logic must be bounded and connection creation must be rate-aware.

## Hyperliquid

Continue to use a safety-focused derivatives adapter.

Isolated margin remains an explicit safety requirement. Hyperliquid documentation states cross margin is the default while isolated margin is supported and confines collateral to the isolated asset/position context.

## Binance

Use as a research/reference venue and later as an execution venue only after a dedicated adapter passes its own gates.

Current Binance documentation exposes authenticated WebSocket user data and ordering semantics that the adapter must respect.

---

# 37.1 Protective-exit capability policy

Protective exit capability is a first-class venue capability. For each venue, the adapter must publish whether native protective/conditional orders are supported, what triggers them, their reduce-only semantics, persistence behavior, and failure modes.

Policy:

1. If a native protective order is officially documented, supported for the target instrument, and passes contract/integration/chaos tests, it may be used only where it materially improves survivability without violating the execution policy.
2. If no verified native protective mechanism exists, the system shall use the software-managed stop path only under an explicit `SOFTWARE_STOP_ONLY` venue capability.
3. `SOFTWARE_STOP_ONLY` increases operational risk and therefore imposes a stricter maximum canary allocation:
   - initial real-capital allocation <= 25% of verified account equity;
   - allocation may not exceed the venue-specific ordinary canary cap;
   - process-supervisor/restart-readiness is mandatory;
   - any unattended-process incident immediately demotes the strategy to PAPER/SHADOW until re-approved.
4. A venue with unknown protective-exit semantics is `SPEC_BLOCKED` for real-capital deployment.
5. No implementation may assume native stop behavior from an undocumented endpoint, UI feature, or community example.

The residual risk statement must name the precise failure cases: process failure, host failure, network partition, exchange outage, stale data, and reconciliation uncertainty.

For spot venues without reduce-only semantics, a protective sell order must be modeled as disposal of held inventory, not assumed to behave like a derivative reduce-only order. The adapter must prove quantity ownership, trigger semantics, cancellation semantics, and duplicate-order behavior before production use.

# 38. Failure Taxonomy

Every failure must map to one or more of:

```text
DATA_FAILURE
MODEL_FAILURE
STRATEGY_FAILURE
EXECUTION_FAILURE
VENUE_FAILURE
STATE_FAILURE
SECURITY_FAILURE
PERSISTENCE_FAILURE
RESEARCH_INTEGRITY_FAILURE
CLOCK_FAILURE
CONFIG_FAILURE
UNKNOWN_FAILURE
```

Unknown failures must not be silently classified as harmless.

---

# 39. Kill-Switch Expansion

The v1.5 kill switch remains mandatory for hard safety conditions.

v2 adds independent strategy/model controls:

```text
STRATEGY_KILL
MODEL_KILL
VENUE_KILL
DATA_KILL
RESEARCH_INTEGRITY_KILL
SYSTEM_KILL
```

These may escalate into the global kill switch when exposure or safety requires it.

---

## 39.1 Scope-Aware Kill Authorization and Precedence

Kill authorization is not a single total order. It is a scope-aware applicability relation plus monotonic latching. The hierarchical scopes are `SYSTEM > VENUE > STRATEGY`; `DATA_KILL`, `MODEL_KILL`, and `RESEARCH_INTEGRITY_KILL` are cross-cutting and apply according to the live dependency/model/research graph recorded at trigger time.

For a target mutation, authorization shall require:

```text
MutationAllowed(target, snapshot) :=
  NOT SystemKillActive
  AND NOT ExistsHierarchicalKill(target.scope)
  AND NOT ExistsCrossCuttingKill(applies_to(target))
  AND AllRequiredClearConditionsSatisfied(target)
  AND snapshot.kill_state_version == current.kill_state_version
  AND snapshot.dependency_graph_version == current.dependency_graph_version
  AND snapshot.risk_authorization_version == current.risk_authorization_version
  AND snapshot.execution_policy_version == current.execution_policy_version
```

Kill state and authorization versions are monotonically increasing and durably recorded. A clear operation can never reduce a version or clear a kill outside its authorized scope. `SYSTEM_KILL` cannot be cleared by strategy-, venue-, data-, model-, or research-level actions.

Any concurrent mutation authorization must use a versioned `AuthorizationSnapshot` and be revalidated immediately before the commit boundary. A snapshot that was valid before a kill, dependency-graph change, policy change, or risk change becomes stale and cannot be handed to the remote executor.

# 40. Chaos / Fault Injection

The existing v1.5 execution chaos suite remains mandatory. v2 upper-plane chaos is also mandatory and must be individually named, injected, observed, and asserted.

## 40.1 Data-plane scenarios

1. Missing event sequence.
2. Out-of-order event.
3. Duplicate event.
4. Corrupted event payload.
5. Crossed book.
6. Empty book.
7. Stale book.
8. Clock timestamp regression.
9. Reference-venue divergence spike.
10. Partial network partition.

## 40.2 Research/model scenarios

11. Model timeout.
12. Model returns NaN/Infinity.
13. Probability outside [0,1].
14. Feature schema mismatch.
15. Missing feature.
16. Unexpected feature unit/version.
17. Stale model artifact.
18. Wrong model artifact hash.
19. Cost-model mismatch.
20. Strategy version mismatch.
21. Regime UNKNOWN.
22. Regime model timeout.
23. Research artifact missing.
24. Replay nondeterminism.
25. Adversarial research result selection.
26. AI-generated malformed proposal.
27. AI proposal modifies hypothesis after seeing result.
28. Multiple-testing ledger corruption or omission.
29. Independent reviewer disagrees with promotion.
30. Promotion attempted with unapproved artifact.
31. Research run attempted without a committed ResearchTrialReceipt.
32. Research process crashes after receipt creation but before result persistence.
33. Research runner reports fewer completed trials than receipt ledger.
34. Family-level selection occurs after observing comparative results without lineage.
35. DSR trial count disagrees with committed ledger.
36. Kelly payoff-ratio stress input is missing, malformed, or optimistic-only.

## 40.3 Decision/risk/capital scenarios

37. Decision stale at execution time.
38. Decision/Risk schema major-version mismatch.
39. Portfolio risk aggregation conflict.
40. Correlation UNKNOWN.
41. Stressed loss exceeds limit after a second strategy appears.
42. Capital promotion race.
43. Capital demotion while an order is pending.
44. Strategy-health degradation during canary.
45. Venue capability changes between decisions.
46. Minimum viable capital falls below current allocation.

## 40.4 Expected assertions

Every scenario must assert:

- terminal state;
- allowed and forbidden mutations;
- journal/audit events;
- alerts;
- persistence outcome;
- recovery path;
- whether capital promotion/demotion is allowed;
- whether an operator action is required.

A chaos scenario is not considered covered merely because the process survived; the expected safety semantics must be asserted.

## 40.5 Deterministic Chaos Contract

Every registered chaos scenario shall define at minimum:

`scenario_id, precondition, fault_injection, expected_state, expected_mutation_prohibition, expected_recovery, expected_audit_event, severity, evidence_artifact`.

The harness must have a machine-checkable registry, a mutation-coverage measure, and negative-control scenarios that are intentionally capable of failing when safety assertions are broken. Process liveness alone never counts as a safety assertion.

The mandatory execution-race scenarios include: kill before final revalidation; kill after authorization snapshot but before final revalidation; dependency consumer change before commit boundary; snapshot replay; kill/clear race; and kill after commit boundary producing `IN_FLIGHT`/reconciliation semantics.

### 40.5.1 GAP-08 assertion contract

| Scenario | Mandatory assertion | Remote mutation | Recovery / state rule |
|---|---|---:|---|
| Kill before final revalidation | `DENIED` + `STALE_AUTHORIZATION` | `0` | slot free; no pending mutation |
| Dependency-version race before commit boundary | `DENIED` + stale/version failure | `0` | new mutation blocked until authoritative dependency state is valid |
| Snapshot replay | `DENIED` + `SNAPSHOT_REPLAY` | `0` | nonce remains permanently consumed |
| Kill after commit boundary | `IN_FLIGHT` when remote outcome is unknown | `>=1` handoff attempt is observable in the test executor | exchange reconciliation mandatory; no false zero-mutation claim |
| Kill/clear race | higher-scope applicable kill remains effective until an authorized clear is durably committed | `0` before commit | authorization snapshot becomes stale on version change |

The test harness shall never use wall-clock sleeps to establish a race. Deterministic barriers or equivalent scheduler controls are required. The harness must not directly modify safety state through the barrier itself.

## 41.1 Test/Production Capability Parity Release Gate

A release candidate may not claim verified safety unless the production artifact's resolved dependency graph and composition are demonstrably consistent with the safety implementation verified by the test suite. Test-only barriers, mutation executors, fault injectors, mock authority providers, debug endpoints, and fixture credentials must be absent from the production artifact.

Test builds may use `DeterministicBarrier` and `TestMutationExecutor`; production builds shall use `NoOpBarrier` and the production remote executor. In both cases the same production safety authorization, risk, kill, dependency, and final-revalidation logic must execute. CI shall inspect the production dependency graph and artifact contents for test-only capability leakage.

This is a hard release gate; it does not itself grant production deployment authority.

# 41. Testing Pyramid

## Unit

- formulas,
- Decimal arithmetic,
- feature calculation,
- rounding,
- probability calibration utilities,
- risk calculations.

## Property

- invariants,
- monotonic limits,
- no-size-up behavior,
- no-negative-risk behavior,
- state consistency.

## Contract

- every venue API method used,
- response schema validation,
- SDK/API version compatibility.

## Integration

- real testnet/sandbox read/write scenarios where available.

## Replay

- deterministic historical event playback.

## Chaos

- failure and recovery.

## Statistical validation

- out-of-sample performance,
- walk-forward,
- robustness.

## Security

- secret leakage,
- permission checks,
- signer isolation,
- mutation authorization.

---

# 42. Promotion State Machine

```text
IDEA
 ↓
HYPOTHESIS
 ↓
RESEARCH
 ↓
BACKTEST
 ↓
VALIDATED
 ↓
PAPER
 ↓
SHADOW
 ↓
TESTNET
 ↓
CANARY
 ↓
PRODUCTION
```

Failure can return the candidate to:

`RESEARCH` or `REJECTED`.

A failed candidate must not be silently modified into a new candidate while retaining the old performance record.

---

# 43. Mainnet / Real-Capital Gate

Real capital can be activated only when all applicable gates pass.

## Technical

- all required builds pass,
- all safety tests pass,
- all chaos tests pass,
- all adapter contract tests pass,
- no unresolved P0/P1 issue.

## Quant

- strategy has independent out-of-sample evidence,
- realistic execution model used,
- no unresolved leakage,
- research-trial count recorded,
- acceptable overfitting diagnostics,
- stable performance across required periods/regimes.

## Operations

- shadow mode completed,
- testnet/paper behavior reconciled,
- monitoring operational,
- alerting operational,
- recovery tested.

## Security

- production signer created outside coding agent,
- least privilege configured,
- secret storage validated,
- deployment approved by authorized operator.

## Capital

- initial capital does not exceed approved canary allocation,
- pre-defined maximum loss is accepted,
- capital scaling policy is enabled and tested.

## Human gate

A human operator explicitly authorizes the first real-capital deployment.

The real-capital gate shall also confirm that repeated strategy-loss escalation cannot silently reset on restart and that any `STRATEGY_KILL` state is persisted and requires explicit re-promotion.

---

# 44. Initial Capital Principle

The first real deployment shall use the smallest amount that is:

1. technically executable,
2. large enough to satisfy minimum order constraints,
3. economically measurable after fees/costs,
4. small enough that total loss is operationally acceptable.

TRY 500 may therefore be a **starting experiment target**, but the system must calculate whether TRY 500 is actually viable for the selected venue and market before placing any order.

If it is not viable, the system must report:

`CAPITAL_BELOW_MINIMUM_VIABLE_THRESHOLD`

rather than forcing a trade.

---

# 45. Capital Growth Logic

## 45.0 Capital scaling is a controlled experiment

Capital is a production parameter, not a reward. Each allocation level must have a maximum approved capital, maximum risk budget, and rollback trigger.

A scaling decision must use a pre-declared policy containing:

- evidence window,
- minimum effective sample,
- net expectancy requirement,
- drawdown bound,
- execution-deviation bound,
- strategy-health state,
- incident-free requirement,
- maximum step-up percentage.

The default scaling rule is:

```text
NO SCALE
if any gate is unknown, breached, or missing evidence

SCALE ONLY ONE LEVEL
if all promotion gates pass for the declared evidence window

DEMOTE ONE OR MORE LEVELS
if degradation gates trigger

HALT
if critical safety or state-integrity gates trigger
```

No rule may compound capital solely because prior capital doubled.

Capital scaling shall be stepwise.

Example conceptual ladder:

```text
CANARY
  ↓ evidence gate
LEVEL_1
  ↓ evidence gate
LEVEL_2
  ↓ evidence gate
LEVEL_3
  ↓ evidence gate
...
```

The exact TRY amounts are configuration, not strategy truth.

A level may be promoted only when evidence shows the strategy is operating within expected bounds.

A level must be demoted when evidence deteriorates.

---

# 46. Definition of “First Fruit”

The first measurable success is not necessarily 2x capital.

The first fruit is:

> A real-market result demonstrating that at least one validated strategy can execute according to specification and produce net-positive expectancy over a meaningful evaluation period without violating safety/risk controls.

A small positive result that survives audit is more valuable to the project than a dramatic but unexplained short-term return.

---

# 47. Definition of Strategy Success

A strategy is provisionally successful when:

- it shows positive net expectancy in independent evaluation,
- the effect remains after realistic costs,
- the effect survives plausible stress assumptions,
- its execution behavior is consistent with simulation,
- its risk profile is within policy,
- its performance does not depend on a single anomalous episode,
- no unresolved model/data leakage exists.

A strategy is production-ready only after the full promotion gate.

---

# 48. Definition of Project Failure

The project shall be considered unsuccessful if, after disciplined research:

- no statistically credible edge can be found,
- every edge disappears after realistic execution costs,
- strategies fail independently of model complexity,
- live behavior systematically contradicts research assumptions,
- operational complexity overwhelms measurable economic value.

A rigorous NO-GO is a valid research outcome.

The platform shall not manufacture trades simply to produce activity.

---

# 49. Required Repository Structure

```text
src/
  config/
  domain/
  persistence/
  data/
  venues/
  market-data/
  features/
  regimes/
  research/
  backtest/
  replay/
  models/
  calibration/
  strategy/
  risk/
  execution/
  capital/
  monitoring/
  alerts/
  security/
  app/

test/
  unit/
  property/
  contract/
  integration/
  replay/
  statistical/
  chaos/
  security/

research/
  runner/
  receipts/
  experiments/
  datasets/
  reports/
  models/

config/
docs/
```

---

# 50. Module Authority Rules

```text
Data Plane
  → immutable observations only

Feature Engine
  → features only

Strategy
  → SignalIntent only

Model
  → prediction / probability only

Risk Engine
  → ApprovedOrderIntent or NO_TRADE

Capital Engine
  → approved allocation bounds only

Execution Kernel
  → physical mutation coordination

Venue Adapter
  → exchange-specific API/SDK only

AI Research
  → proposals and analysis only
```

No module may skip one of these authority boundaries.

---

# 51. Implementation Phases

## Phase 0 — Specification audit

Independent multi-role review of this document.

Exit:

- no unresolved contradictory requirements,
- safety invariants reviewed,
- strategy assumptions explicitly classified as hypotheses.

## Phase 1 — Safety Kernel migration

Port v1.5 execution/risk/recovery kernel into the v2 architecture without changing behavior.

Exit:

- v1.5 regression suite passes.

## Phase 2 — Venue abstraction

Implement the BtcTurk spot adapter first for the declared baseline experiment. Hyperliquid remains a separately verified derivatives adapter and may not substitute for the first venue without a versioned decision amendment.

Exit:

- current official API contract verified,
- adapter tests pass.

## Phase 3 — Data Lake

Implement immutable data capture.

Exit:

- deterministic re-read of recorded sessions.

## Phase 4 — Replay Engine

Exit:

- identical input produces identical output.

## Phase 5 — Baseline Alpha

Implement one intentionally simple research strategy.

Exit:

- deterministic backtest,
- realistic cost model,
- no leakage.

## Phase 6 — Execution Simulation

Exit:

- queue/latency/partial-fill behavior represented to the extent data permits.

## Phase 7 — Statistical Validation

Exit:

- OOS,
- walk-forward,
- required overfitting diagnostics,
- complete research ledger.

## Phase 8 — Shadow Mode

Exit:

- live signals tracked without live orders,
- simulated-vs-real-market reconciliation.

## Phase 9 — Testnet/Paper

Exit:

- execution and recovery evidence retained.

## Phase 10 — Canary

Exit:

- real capital remains within canary allocation,
- no safety incident,
- actual net execution behavior consistent with expectations.

## Phase 11 — Controlled Scaling

Exit:

- capital increments only through formal promotion gates.

---

# 52. Acceptance Criteria for a “Complete” System

A coding team may not declare the platform complete merely because the application runs.

The complete system must demonstrate:

1. deterministic reproducibility,
2. data lineage,
3. strategy versioning,
4. experiment lineage,
5. realistic replay/backtest,
6. probabilistic forecast support,
7. cost-aware EV,
8. risk controls,
9. execution safety,
10. recovery safety,
11. capital scaling/demotion,
12. model/strategy drift handling,
13. venue adapter isolation,
14. AI governance,
15. independent review evidence,
16. operational runbooks,
17. production gate evidence.

---

# 53. Required Deliverables Before First Real Trade

The project must produce:

- architecture document,
- current venue adapter specification,
- market-data schema,
- research ledger schema,
- strategy artifact schema,
- risk policy,
- execution policy,
- backtest report,
- OOS report,
- execution-simulation report,
- security review,
- chaos test report,
- shadow report,
- canary allocation policy,
- runbook,
- rollback/stop procedure,
- independent reviewer findings.

---

# 54. Final Engineering Invariants

```text
UNKNOWN > ACTION
NO_TRADE > BAD_TRADE
BAD_TRADE > UNCONTROLLED_RISK

MODEL > OPINION
EVIDENCE > NARRATIVE
OUT-OF-SAMPLE > BACKTEST
REALIZED EXECUTION > SIMULATED EXECUTION
RISK LIMIT > POSITION DESIRE
CAPITAL PRESERVATION > PROFIT
```

Additional prohibitions inherited or strengthened:

```text
no hidden strategy changes
no live auto-optimization
no AI direct execution
no withdrawal capability in trading signer
no silent dependency upgrades
no future-data leakage
no fictional fills
no false precision in probability
no capital scaling without evidence
no martingale recovery rule
no order mutation outside execution coordinator
no unresolved mutation followed by another mutation
no auto-resume after safety halt
no mainnet activation by coding agent
```

---

# 55. Review Status Matrix

This matrix is normative. `APPROVED` means the section is internally consistent, has an explicit implementation/verification method, has no unresolved P0/P1 contradiction, **and has passed the current required review cycle**. `REVIEW_REQUIRED` means the section is awaiting the next independent review cycle for this specification version. `CHANGES_REQUIRED` means a tracked issue exists; `BLOCKED` means implementation must not proceed through that scope. `OUT_OF_SCOPE` means explicitly excluded from the current release.

While a specification version carries `REVIEW_REQUIRED`, the matrix may not claim overall `APPROVED`. A release-build consistency check shall assert:

- any row with `REVIEW_REQUIRED`, `CHANGES_REQUIRED`, or `BLOCKED` forces overall matrix status to `REVIEW_REQUIRED` or `BLOCKED`;
- overall `APPROVED` requires every in-scope row to be `APPROVED`, zero ownerless P2 blockers, and completion of the independent review cycle required by §59;
- document header status, matrix status, Definition-of-Done status, and final strategic judgment must agree on the release state;
- any contradiction is `SPECIFICATION_STATE_INTEGRITY_FAILURE`.

| Section | Status | Primary reviewer(s) | Verification method | Gate note |
|---|---|---|---|---|
| 1–4 Mission, governance, constitutional principles | REVIEW_REQUIRED | CEO / Investor / Architect | document consistency audit + requirements trace + mission-evidence audit | v2.6 reframes economic mission and discovery priority; next independent review required |
| 5–10 Venue, data, schemas, research protocol | REVIEW_REQUIRED | Architect / Quant / Senior Engineer | schema tests + contract tests + traceability audit | Venue facts still require current adapter verification |
| 11–16 Feature, regime, alpha and probability layers | REVIEW_REQUIRED | Quant / AI Researcher / Trader | deterministic fixtures + leakage tests + model artifact tests | Next adversarial review required for v2.8 |
| 17–21 Statistical validation and promotion gates | REVIEW_REQUIRED | Quant / Investor | replay, OOS, walk-forward, PBO/CSCV, DSR and multiple-testing audit | Next adversarial review required for v2.8 |
| 22–24 Decision and Risk interfaces/aggregation | REVIEW_REQUIRED | Risk Manager / Architect | type/schema compatibility tests + risk aggregation property tests | Next adversarial review required for v2.8 |
| 25–29 Capital, AI governance and isolation | REVIEW_REQUIRED | Risk / Security / AI Researcher | sandbox/network/filesystem denial tests + lineage tests | Next adversarial review required for v2.8 |
| 30–36 Review, adversarial, testing and security architecture | REVIEW_REQUIRED | All personas / Security Engineer | adversarial review + test-plan traceability | Every mandatory requirement has a verification owner |
| 37–40 Venue protection, failure taxonomy, kill-switch, chaos | REVIEW_REQUIRED | Trader / Security / Senior Engineer | venue capability tests + 46 chaos scenarios + state assertions | Next adversarial review required for v2.8 |
| 41–48 Testing, promotion, capital and success/failure definitions | REVIEW_REQUIRED | Quant / Risk / CEO / Investor | CI gates + promotion state-machine tests | Real-capital gate remains independent of spec approval |
| 49–54 Repository, authority, phases, acceptance, deliverables, invariants | REVIEW_REQUIRED | Senior Engineer / Architect | implementation traceability + static review | Next adversarial review required for v2.8 |
| 55 Review Status Matrix | REVIEW_REQUIRED | Architect / Senior Engineer | self-consistency audit + release-build state-integrity checks | v2.8 hardening state changed; next adversarial review required |
| 56 Pre-Implementation Decision Pack | REVIEW_REQUIRED | CEO / Quant / Risk / Trader | signed decision record + amendment control | v2.8 retains the v2.7 research priority and adds executable safety-kernel hardening |
| 57 Definition of Done | REVIEW_REQUIRED | Architect / CEO | release checklist + traceability | v2.8 hardening and implementation traceability require adversarial verification |
| 58 External Verification Baseline | REVIEW_REQUIRED | Security / Architect / Quant | source/version verification during implementation | Current API facts must be revalidated before adapter release |
| 59 Iterative Review Closure Protocol | REVIEW_REQUIRED | All personas | review-record audit + independent re-review | This protocol governs the v2.8 hardening review cycle itself |
| 60 Final Strategic Judgment | REVIEW_REQUIRED | CEO / Investor / all independent reviewers | approval-state audit | Must remain aligned with matrix/header state until review closure |

**Matrix rule:** A new P0/P1 issue immediately moves the affected section to `CHANGES_REQUIRED` or `BLOCKED` and resets the overall specification status to `REVIEW_REQUIRED`. A P2 item must have an explicit owner and disposition date; an ownerless P2 is a blocker.

**Overall v2.8 matrix status:** `REVIEW_REQUIRED`. v2.8 is not specification-approved. No implementation claim may infer approval from a partial row-level review.

# 56. Pre-Implementation Decision Pack

The following decisions are fixed as the v2.8 baseline so that implementation agents do not invent them; v2.7 remains the preceding immutable review artifact. Any later change requires a versioned amendment with independent review.

## 56.1 First live research/execution candidate

**Default first candidate:** BtcTurk spot, BTC/TRY, one strategy, very small capital.

**Execution assumption:** BtcTurk is treated as a limit/market/stop-order venue unless the current official capability profile proves otherwise. Hyperliquid ALO/maker evidence must never be imported into BtcTurk research without explicit execution-profile equivalence.

**Fallback:** Hyperliquid perpetuals remain the first derivatives execution candidate using the retained v1.5 Safety/Execution Kernel.

This is an experiment priority, not a claim that BtcTurk is economically superior to Hyperliquid. The BtcTurk candidate must first pass current API, fee, minimum-size, liquidity, authentication, order-semantics, and operational feasibility checks.

## 56.2 First strategy research program

The first research program is not required to prove the inherited mean-reversion idea. It must compare a pre-declared small set of candidate mechanisms under one common evaluation framework.

**Priority A — Baseline:** short-horizon mean reversion conditional on price dislocation, microstructure confirmation, liquidity, regime suitability, and positive net expected value.

**Priority B — Structural/venue-specific:** measurable liquidity, spread, session, fee, inventory, or fragmentation effects available on the selected venue.

**Priority C — Cross-venue informational:** lead/lag or divergence signals using BtcTurk + reference venues as data sources; cross-venue execution remains out of the first live scope unless separately approved.

The older v1.5 z-score rule is a baseline feature/hypothesis, not a production strategy by itself.

Family selection itself is part of the multiple-testing ledger under §20.6.

## 56.3 First model family

The first predictive model shall be a calibrated logistic regression or equivalent generalized linear model. A tree-based challenger may be evaluated later. Neural models are out of the first production path unless data volume and validation demonstrate material incremental value.

## 56.4 Minimum viable capital

There is no hard-coded TRY minimum. The system computes it from venue constraints, fees, expected spread/slippage, strategy sizing, and a minimum economically meaningful trade. TRY 500 is an experimental starting budget only if the computed viability gate permits it.

## 56.5 Statistical thresholds

The baseline gates in §21 are the initial normative defaults. Any strategy-specific alternative must be stricter or be approved through a formal research-policy amendment with independent review.

## 56.6 Canary ladder

The initial live ladder is percentage-based rather than fixed-currency: the first canary allocation is the minimum of a pre-approved absolute cap, the smallest fraction that permits the strategy to operate without violating venue minimums, and the unattended-loss cap defined for the venue. Each successful promotion increases allocation by at most 2x the previous canary level, and only after the mandatory evidence, dwell, observation-count, velocity, exposure, liquidity, and aggregate-risk gates in §25.5 pass. A degradation event may reduce one or more levels immediately. Level skipping is forbidden.

## 56.7 Decision ownership

- Product/economic scope: CEO/Investor review
- Statistical policy: Quant lead
- Production interfaces: Architect/Senior Engineer
- Security boundaries: Security Engineer
- Capital/risk policy: Risk Manager
- Execution policy: Trader/Execution specialist
- AI research governance: AI Research lead

No implementation model is an authority for any of these decisions.

# 57. Definition of Done for v2.8

HYPER-QUANT v2.8 is ready for the next implementation phase only when:

- independent reviewers find no unresolved P0/P1 contradiction,
- safety kernel requirements are internally consistent,
- first venue contract is verified,
- data schema is fixed,
- baseline research protocol is fixed,
- backtest/replay methodology is fixed,
- anti-overfitting procedure is fixed,
- capital gate philosophy is fixed,
- implementation boundaries are unambiguous.

HYPER-QUANT v2.8 is ready for **real capital** only after a separate production gate passes.

---

# 58. External Verification Baseline — 2026-09-06

The architecture was reviewed against current public sources for the major external dependencies and methodological risks.

### Hyperliquid

- isolated margin is supported and cross margin is the default according to current official margining documentation;
- current WebSocket documentation includes order-book/account-related subscriptions;
- the nktkas SDK has continued to evolve beyond the v1.5-pinned version, so implementation must perform an explicit version-selection and contract-test step.

### BtcTurk

- official docs separate V1 authenticated operations from V2 public market data;
- official exchange information exposes trading symbols, scales, order methods and minimum exchange values;
- official docs publish rate limits and WebSocket connection constraints;
- authenticated API permissions are separately configurable.

### Binance

- official documentation provides authenticated user data streams and documents event ordering behavior;
- any Binance adapter must therefore preserve exchange-specific event semantics rather than rely on generic assumptions.

### Software security

NIST SSDF recommends integrating security practices into the development lifecycle. The platform therefore treats security as architecture, build, testing, deployment, and operations rather than a final checklist.

### Statistical validation

Research on backtest overfitting motivates tracking the number of trials and using dedicated overfitting diagnostics such as PBO/CSCV and related multiple-testing-aware methods.

---

# 59. Iterative Review Closure Protocol

HYPER-QUANT uses an explicit iterative review loop. A specification version is not considered fully approved because one review cycle is positive.

```text
MASTER SPEC
  ↓
INDEPENDENT MULTI-PERSONA REVIEW
  ↓
P0/P1/P2 CLASSIFICATION
  ↓
CORRECT / REJECT / DEFER WITH OWNER
  ↓
NEW SPEC VERSION
  ↓
INDEPENDENT RE-REVIEW
  ↺ until no unresolved P0/P1/P2 and no ownerless blocker remains
```

A release-build consistency check shall compare the canonical version token against the document title, revision, version, section self-references, architecture labels, generated filenames, and end marker. A mismatch is `SPECIFICATION_IDENTITY_FAILURE` and resets the specification to `REVIEW_REQUIRED`.

Each review cycle must include, at minimum:

- CEO / Investor economic viability review;
- Quant statistical validity review;
- Senior Engineer implementation review;
- Architect contract/boundary review;
- Security Engineer threat-model review;
- Risk Manager aggregate-risk review;
- Trader / Execution microstructure review;
- AI Researcher model/data-science governance review;
- adversarial reviewer whose explicit job is to break the proposal.

Reviewers may introduce new questions. When a question changes an authority boundary, economic objective, safety invariant, statistical promotion rule, or capital policy, the question becomes a tracked specification issue rather than an informal comment.

The user/business owner may also submit new requirements at any review cycle. Such requirements must be classified as `NEW_REQUIREMENT`, `CHANGE_REQUEST`, or `CONFLICT` and then routed through the same review process.

No specification version may self-certify “100% complete”. The final status may only be:

`REVIEW_REQUIRED`, `IMPLEMENTATION_CANDIDATE`, or `APPROVED_FOR_IMPLEMENTATION`.

`APPROVED_FOR_IMPLEMENTATION` requires zero unresolved P0/P1 contradictions, zero ownerless P2 blockers, a complete review matrix, and explicit evidence that every mandatory requirement has an implementation or verification method.

# 60. Final Strategic Judgment

**PROJECT STATUS: GO — SPECIFICATION REVIEW CONTINUES**

**v1.5 AS FULL PRODUCT SPECIFICATION: NO-GO**

**v1.5 AS SAFETY/EXECUTION KERNEL: STRONG GO**

**v2.8 AS RESEARCH + VALIDATION + CAPITAL-GROWTH PLATFORM: REVIEW CANDIDATE; EXECUTION-SAFETY SUBSET HARDENED, RESEARCH/CAPITAL/LIVE VENUE IMPLEMENTATION STILL PENDING**

The earlier independent reviews identified four material gaps in v2.0:

1. insufficiently explicit management success/stop criteria,
2. under-specified statistical promotion gates,
3. incomplete aggregate-risk and upper-plane failure semantics,
4. architectural rather than technical AI isolation.

v2.8 incorporates the v2.7 corrections and provides a stronger non-live implementation proof for the execution-safety subset, while explicitly preserving unresolved research, capital, and live-venue implementation gaps. Remaining venue-specific facts must still be validated from current official documentation during adapter implementation; the specification deliberately forbids inventing undocumented API behavior.

The project is implementation-candidate at the **architecture, research protocol, governance, and safety-contract level**; the current repository proves only a non-live execution-race scaffold, while venue adapters, durable storage, signer boundaries, and broader research controls remain subject to implementation and verification gates.

The fundamental economic objective remains: start as small as operationally meaningful, search for real net edge, validate it independently, execute it safely, and scale capital only as evidence improves.

The system must be willing to conclude:

```text
NO EDGE FOUND
NO ECONOMIC VIABILITY
STRATEGY DEGRADED
CAPITAL TOO SMALL
EXECUTION UNSAFE
PROJECT PAUSE / PIVOT
```

These are successful control outcomes, not failures of the engineering process.

The system is never permitted to manufacture a trade simply because the user wants capital growth.
# END OF MASTER SPECIFICATION v2.8
