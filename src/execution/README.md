# Execution

Reserved for the safety/execution kernel. This area must preserve durable intent, reconciliation, protective-exit behavior, and fail-closed controls.

## Execution simulation

`simulator.ts` is a non-live deterministic execution reference. It models market/limit fills, liquidity caps, fees, slippage, cash/position constraints, realized/unrealized PnL, and produces a reproducible result hash. It cannot reach a live venue gateway.
