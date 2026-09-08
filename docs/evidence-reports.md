# Evidence report register

The first evidence increment is a deterministic, read-only fixture bound to
BtcTurk `BTC/TRY`. It produces metadata only; it does not connect to a venue,
submit orders, move capital, or authorize promotion.

| ID | Report | Status |
|---|---|---|
| RPT-01 | Baseline Research Campaign Report | PARTIAL |
| RPT-02 | Reproducibility and Data Lineage Certificate | PARTIAL |
| RPT-03 | Independent Statistical Evidence Package | PARTIAL |
| RPT-04 | Replay Determinism Certificate | OPEN |
| RPT-05 | Execution Cost and Slippage Report | OPEN |
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
