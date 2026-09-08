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

Production signer access must remain isolated from research and AI processes. BtcTurk mutation requires an externally supplied signer/auth boundary and mutation gateway; no private key implementation exists in this repository.
