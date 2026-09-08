# Research

Reserved for research-plane services: trial receipts, replay, features, regimes, validation, EV/probability, and research ledger integration.

## Deterministic research vertical slice

The v2.9 reference implementation now contains a non-live research path:

`Market bars → feature engine → purged/embargoed split → baseline strategy → deterministic backtest → cost-adjusted result`

The feature engine passes only bars available at or before the decision index into feature calculators. Features are unavailable until their declared lookback is satisfied. Backtest signals are applied only on a later execution bar (`signal index + 1 + latencyBars`), so a strategy cannot execute on the same bar that produced its signal.

This is a research harness, not evidence of alpha or venue profitability. Live market data, holdout credentials, statistical promotion, and live mutation remain separately gated.


## Research governance vertical slice

`ResearchRunner` is the approved reference entry point for controlled non-live trials. It persists the receipt before compute, validates dependency and artifact identity, reserves holdout budget before final evaluation, derives multiple-testing count from the committed trial ledger, and persists terminal outcomes. Promotion authority is not granted by this runner.
