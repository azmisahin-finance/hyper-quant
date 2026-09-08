# Research

Reserved for research-plane services: trial receipts, replay, features, regimes, validation, EV/probability, and research ledger integration.

## Deterministic research vertical slice

The v2.9 reference implementation now contains a non-live research path:

`Market bars → feature engine → purged/embargoed split → baseline strategy → deterministic backtest → cost-adjusted result`

The feature engine passes only bars available at or before the decision index into feature calculators. Features are unavailable until their declared lookback is satisfied. Backtest signals are applied only on a later execution bar (`signal index + 1 + latencyBars`), so a strategy cannot execute on the same bar that produced its signal.

This is a research harness, not evidence of alpha or venue profitability. Live market data, holdout credentials, statistical promotion, and live mutation remain separately gated.


## Research governance vertical slice

`ResearchRunner` is the approved reference entry point for controlled non-live trials. It persists the receipt before compute, validates dependency and artifact identity, reserves holdout budget before final evaluation, derives multiple-testing count from the committed trial ledger, and persists terminal outcomes. Promotion authority is not granted by this runner.

## Research validation vertical slice

The v2.9 research plane now includes executable walk-forward folds, a deterministic CSCV/PBO diagnostic, and declared regime-segment evaluation. These diagnostics are non-live governance controls: they do not claim alpha, guarantee future performance, or replace independent review.

## Walk-forward / overfitting / regime validation

`createWalkForwardFolds` produces chronological non-overlapping out-of-sample folds and requires the declared purge+embargo gap. `computePboCscv` provides a deterministic CSCV/PBO diagnostic over candidate return paths and refuses combinatorial expansion above a declared cap. `evaluateRegimeCoverage` evaluates only explicit regime segments over explicit out-of-sample indices. These are governance diagnostics and must be bound to a committed research receipt before promotion use.

## Research campaign orchestration

`ResearchCampaignRunner` is the controlled non-live search entry point. It registers every candidate before compute, derives the committed trial count from the durable trial ledger, selects deterministically by mean return, computes CSCV/PBO and DSR from the resulting candidate set, and persists a campaign evidence record. It does not consume holdout data and does not grant promotion authority; holdout evaluation remains a separate post-selection control boundary.
