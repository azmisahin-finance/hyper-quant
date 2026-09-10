# Source Tree

Implementation is intentionally separated from the specification while the v2.9 candidate is under review.

Expected implementation boundaries include:

- domain models,
- research services,
- data ingestion,
- replay and simulation,
- feature/regime engines,
- validation and allocation engines,
- venue execution adapters,
- safety/execution kernel,
- audit/event infrastructure.

## M1 product slice

`product/paper-bot.ts` composes a read-only market snapshot, deterministic
strategy decision, bounded simulated risk check, the existing paper executor,
position/PnL accounting, an event record, and operator status. It is
permanently `PAPER_ONLY`: it has no credential, signer, live-order, or
capital-mutation surface. See `docs/productization-master-plan.md` for its
acceptance boundary.

Production signer access must remain isolated from research and AI processes. BtcTurk mutation requires an externally supplied signer/auth boundary and mutation gateway; no private key implementation exists in this repository.
