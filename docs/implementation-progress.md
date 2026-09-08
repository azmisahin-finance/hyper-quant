# HYPER-QUANT v2.9 Implementation Progress

Status: REVIEW_REQUIRED

This document records implementation progress without granting production authority.

## Current milestone

Phase 2 has started with a BtcTurk spot adapter based on the currently documented API surface, covering dynamic exchange metadata, ticker snapshots, authenticated balances, open orders, and order-by-id reads. Public endpoints use BtcTurk V2 paths; authenticated account/order reads use documented V1 paths.

The adapter preserves the venue profile as a versioned capability object and normalizes exchange responses into HYPER-QUANT domain types. No API secret or private-key implementation is stored in this repository.

Live order submission and cancellation are deliberately rejected at the adapter boundary. They require the canonical `MutationCoordinator`, an externally controlled signer/authentication boundary, and an explicit mutation gateway. This prevents a venue client from becoming an accidental bypass around the safety kernel.

## Phase 3 data vertical slice

The current v2.9 implementation now includes a normalized market-data recorder and a BtcTurk WebSocket decoder for documented ticker, trade, full order-book, order-book-difference, and subscription models. Recorded events enter the immutable hash-chained log through a serialized append queue so concurrent writers cannot fork sequence/hash state. WebSocket timestamps use venue-provided millisecond timestamps when documented and an injected receive clock otherwise, keeping parser behavior testable and deterministic.

Live WebSocket connectivity is not yet certified in this environment. The adapter therefore remains contract-tested only; no production mutation capability is enabled.

## Phase 3/4 starting point

An immutable, fsync-backed, hash-chained event log and deterministic replay reducer are now available as repository primitives. They are suitable for recorded market-data sessions and deterministic research/replay tests, but production storage durability and recorder deployment remain unverified.

## External evidence

The BtcTurk implementation follows the documented public endpoints for exchange information and ticker/order book data and documented authenticated V1 paths for balances/open orders/order lookup. BtcTurk documents HMAC-SHA256 authentication with `X-PCK`, `X-Stamp`, and `X-Signature`, and documents that cancel requests receive an immediate 200 acknowledgement while final cancellation status is delivered asynchronously over WebSocket; those semantics remain integration-test obligations before any mutation gateway is introduced.
