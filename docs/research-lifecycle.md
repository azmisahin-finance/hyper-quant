# Research Lifecycle

The default promotion path is:

`IDEA → HYPOTHESIS → RESEARCH → BACKTEST → VALIDATED → PAPER → SHADOW → TESTNET → CANARY → PRODUCTION`

Every empirical research run must be registered before compute begins. A durable `ResearchTrialReceipt` is the identity record for the trial. Ad hoc or unregistered runs are not promotion evidence.

A valid research result may be:

- `PROMOTE_CANDIDATE`
- `REJECT`
- `NO_TRADE`
- `INCONCLUSIVE`

The lifecycle is evidence-driven: a positive backtest alone does not authorize deployment.

## v2.9 search-campaign orchestration

The controlled non-live campaign phase registers every candidate trial before compute, records candidate completion or crash, derives the multiple-testing count from the durable trial ledger, performs deterministic candidate selection, computes campaign-level PBO/CSCV and DSR, and persists a final evidence hash. Holdout evaluation is intentionally outside the search campaign and may only occur after candidate selection under the existing holdout controls.
