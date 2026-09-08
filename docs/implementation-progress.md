# Implementation Progress

## v2.9 status

`REVIEW_REQUIRED` / non-live.

### Verified vertical slices

- Safety kernel and execution race controls
- BtcTurk read-only market-data adapter
- Immutable recording and deterministic replay
- Time-aligned features, purge, embargo and deterministic backtest
- Research trial receipt, holdout reservation and statistical governance
- Walk-forward validation, CSCV/PBO diagnostic and regime coverage
- Deflated Sharpe Ratio (classic DSR-LS approximation) computed from the selected return series and committed trial count
- Search-campaign diagnostics binding selected candidate, CSCV/PBO, DSR and a reproducible evidence hash

### Remaining proof obligations

- Independent validation of DSR against production research-data conventions and exact campaign statistics
- Full search-campaign orchestration from candidate generation through durable ledger commits
- Economic regime definitions/classification beyond declared evaluation segments
- Real holdout isolation process/storage boundary
- Live WebSocket connectivity/reconnect certification
- External signer isolation and live venue reconciliation

No live mutation is authorized by this implementation.

## v2.9 research campaign orchestration

The reference implementation now contains a durable non-live `ResearchCampaignRunner` and campaign ledger. Candidate trials are receipted before compute, committed trial count is derived from the trial ledger, candidate selection is deterministic, and campaign-level CSCV/PBO/DSR diagnostics plus an evidence hash are persisted. Holdout execution remains outside the search campaign and is not consumed before candidate selection.

### v2.9 controlled holdout / promotion boundary

The non-live implementation now requires a finalized passing campaign before holdout evaluation, binds the selected candidate and selection evidence to the holdout reservation/evidence hash, prevents raw holdout-shaped payloads from crossing the opaque result boundary, and refuses to construct promotion evidence from FAIL/INCONCLUSIVE holdout results. Physical sealed-holdout storage/process isolation and post-holdout adaptive-search sealing remain open proof obligations.

### v2.9 full research evidence engine

The reference implementation now constructs a single tamper-evident evidence package from finalized campaign selection, controlled holdout evidence, selected return series, walk-forward validation, CSCV/PBO, PSR/DSR, regime coverage, cost stress, and the statistical promotion decision. A durable evidence ledger prevents duplicate final packages for a campaign and serializes concurrent writes. Final holdout physical/process isolation, live venue reconciliation, and signer isolation remain proof obligations outside the non-live reference boundary.
