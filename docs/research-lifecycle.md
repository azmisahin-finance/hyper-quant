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
