# Evidence report register

The first evidence increment is a deterministic, read-only fixture bound to
BtcTurk `BTC/TRY`. It produces metadata only; it does not connect to a venue,
submit orders, move capital, or authorize promotion.

| ID | Report | Status |
|---|---|---|
| RPT-01 | Baseline Research Campaign Report | PARTIAL |
| RPT-02 | Reproducibility and Data Lineage Certificate | PARTIAL |
| RPT-03 | Independent Statistical Evidence Package | PARTIAL |
| RPT-04 | Sealed Holdout Evaluation Certificate | PARTIAL |
| RPT-05 | Execution Cost and Slippage Report | PARTIAL |
| RPT-06 | Walk-Forward Validation Report | OPEN |
| RPT-07 | Overfitting and PBO Diagnostic Report | OPEN |
| RPT-08 | Holdout Evaluation Report | BLOCKED |
| RPT-09 | Risk and Drawdown Report | OPEN |
| RPT-10 | Shadow Execution Comparison Report | BLOCKED |
| RPT-11 | Operational Readiness Report | OPEN |
| RPT-12 | Promotion Decision Record | BLOCKED |

`runFirstEvidenceCampaign` in `src/research/evidence-reports.ts` is the
repository-native fixture runner. Its `COMPLETED`, `NO_TRADE`, and `FAIL`
outcomes are research outcomes only and must not be interpreted as profitability
or live-connectivity evidence.

`buildIndependentStatisticalEvidenceReport` in
`src/research/independent-statistics.ts` is the RPT-03 verifier. It derives the
committed trial count from registered trial identities, binds the selected return
hash to the campaign candidate record, independently recomputes DSR and PSR
using the persisted `PER_PERIOD_ARITHMETIC_MEAN_SAMPLE_STDDEV` convention, and
emits deterministic input, result, lineage, and evidence hashes. It reports
`COMPLETED`, `FAIL`, or `BLOCKED`; none is a promotion or live-trading
authorization.

`src/research/holdout-certificate.ts` is the RPT-04 non-live boundary. It
selects holdout identifiers deterministically from the dataset and campaign
identity, binds the reservation to the finalized campaign, records campaign and
holdout lineage hashes, and detects overlap or evaluator mutation. The
certificate exposes `COMPLETED`, `FAIL`, or `BLOCKED` outcomes. Process and
physical isolation are separate explicit statuses; this repository cannot prove
physical sealed storage, so the fixture remains `BLOCKED` unless an external
review artifact verifies that boundary. RPT-04 is not promotion or live-trading
authorization.

`buildExecutionCostAndSlippageReport` in `src/research/evidence-reports.ts` is the
RPT-05 deterministic execution-cost package. It uses the repository's
`ExecutionCostModel`, `LatencyProfile`, and deterministic execution abstractions
to model explicit fee/slippage cost, spread, latency/staleness, and supported
partial-fill/reject outcomes in `READ_ONLY_NON_LIVE` scope. It binds campaign,
input, result, and evidence hashes to lineage metadata, emits `COMPLETED`,
`FAIL`, or `BLOCKED`, and exposes unsupported-realism blockers such as
`LIVE_AUTHORITY_NOT_SUPPORTED`, `UNKNOWN_IN_FLIGHT_OUTCOME_UNSUPPORTED`, and
`STALE_LATENCY_OUTCOME_UNSUPPORTED` without granting live bridge authority.
