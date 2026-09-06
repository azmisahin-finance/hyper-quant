# Architecture Overview

HYPER-QUANT is partitioned into an **upper research plane** and a **lower safety/execution plane**.

## Upper plane

The upper plane owns research data, hypotheses, backtests, replay, feature generation, regime analysis, probability/EV estimation, strategy validation, research ledgers, AI-assisted hypothesis generation, and capital-allocation proposals.

It must not have direct access to production signing material.

## Lower plane

The lower plane owns venue adapters, order intent validation, durable intent state, signing, submission, reconciliation, protective exits, kill-switch behavior, operational safety, and authoritative execution state.

## Authority boundary

Research and AI may **propose**. The execution kernel may **validate and execute only authorized, validated intent**. Unknown exchange outcomes are reconciled against authoritative venue state before any assumption of flatness or exposure status is made.

## Design objective

The architecture is designed to fail closed where possible, surface ambiguity where necessary, and prevent a local process or model from becoming the sole source of truth for live exposure.
