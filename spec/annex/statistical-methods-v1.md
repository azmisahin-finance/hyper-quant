# HYPER-QUANT Statistical Methods Annex v1

**Status:** REVIEW_REQUIRED
**Applies to:** HYPER-QUANT v2.7

This annex pins methodology choices that materially affect promotion decisions. Any change creates a new annex version and a ledger-visible research-policy amendment; the final holdout may not be used to tune the methodology.

## Required deterministic conventions

- Return aggregation shall use the event-stream order recorded by the trial artifact; no implementation may reorder observations for convenience.
- Mean and variance use the sample estimators declared by the implementation contract; zero-variance series return an explicit `UNDEFINED_STATISTIC`, never an infinite or fabricated value.
- Annualization is a versioned policy input and must be frozen before evaluation; the factor must be derived from the declared sampling interval rather than chosen after observing results.
- Skewness and excess kurtosis use fixed finite-sample estimators defined in the implementation contract.
- DSR shall use the Bailey/López de Prado multiple-testing-aware formulation with trial count sourced from the committed research ledger.
- CSCV shall use a fixed partition count declared by this annex version; changes require a new annex version and independent review.
- PBO aggregation shall be deterministic, including tie handling and treatment of undefined/degenerate partitions.
- Numerical comparisons shall use declared absolute/relative tolerances. A claim of exact bit identity is not required unless a specific operation explicitly requires it.

## Reference vectors

The repository must maintain fixed synthetic reference vectors covering: positive/negative expectancy, zero variance, ties, missing/degenerate partitions, extreme skew/kurtosis, trial-count changes, and annualization boundary cases. Independent implementations must agree within the annex tolerances.

## Researcher-degree-of-freedom rule

An implementation may not select an estimator, annualization factor, partition count, aggregation method, or edge-case convention after seeing final holdout outcomes. Any declared alternative is a new versioned methodology artifact and a new research-policy lineage.
