# Execution

Reserved for the safety/execution kernel. This area must preserve durable intent, reconciliation, protective-exit behavior, and fail-closed controls.

## Execution simulation

`simulator.ts` is a non-live deterministic execution reference. It models market/limit fills, liquidity caps, fees, slippage, cash/position constraints, realized/unrealized PnL, and produces a reproducible result hash. It cannot reach a live venue gateway.

## Order lifecycle vertical slice

Order state is event-driven and canonical: `NEW → ACCEPTED → PARTIALLY_FILLED → FILLED` with explicit `CANCEL_REQUESTED`, `CANCELLED`, `REJECTED`, `EXPIRED`, and `UNKNOWN` branches. Events are monotonic and replay-protected; unknown remote state never implies a local fill/cancel decision.

`OrderLifecycleJournal` persists lifecycle events through the immutable hash-chained event log so restart rehydration is deterministic. This is a persistence primitive; exchange truth remains authoritative for reconciliation.

Lifecycle reconciliation is state-local and restart-safe: fill identities are retained in the canonical state, cancel requests may race with later fills, and remote snapshots are applied only after quantity/time invariants pass. An UNKNOWN remote result never becomes a local FILLED/CANCELLED assumption.


## v2.9 execution realism

The non-live execution layer includes deterministic order-book state, queue-aware resting-order estimation, and conservative two-phase cancel/replace handling. Live mutation remains blocked behind the canonical safety coordinator, mutation gateway, and signer boundary.


## Venue reconciliation

The v2.9 execution plane keeps venue observation and local paper state separate. `VenueObservationTracker` requires resynchronization after reconnects or sequence gaps. `VenueReconciliationController` uses read-only venue adapter methods and fails closed when exact remote fill/remaining quantities are unavailable or account totals violate `free + locked = total`. Live mutation remains outside this layer.

## REST + private WebSocket convergence

`VenueConvergenceEngine` starts each epoch from a read-only REST snapshot. Its account hash is explicitly a REST anchor: private WebSocket messages neither construct nor infer account balances. The fresh `getOpenOrders` comparison proves active-order state only; absence from that endpoint never proves an order was filled, cancelled, rejected, or expired.

Private trade and match messages are retained as identity-bound evidence, not treated as a cumulative filled quantity on their own. Only an exact subsequent REST active-order snapshot may corroborate the delta. Reconnects, missing identities, terminal/delete notifications, unsupported statuses, time regressions, and duplicate evidence fail closed and require a new REST bootstrap. The session's local observation count is audit metadata only, never a venue sequence.
