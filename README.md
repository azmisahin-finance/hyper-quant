# HYPER-QUANT

**Evidence-driven quantitative research, capital-allocation, risk, and execution-safety platform.**

> HYPER-QUANT does **not** assume profitability. Strategies are promoted only through reproducible research, statistical validation, cost-aware simulation, risk controls, and staged deployment gates.

## Project status

**Current specification:** v2.8 — `REVIEW_REQUIRED`

The repository is intentionally public while the specification is still under independent adversarial review. There is **no approved production master specification in this repository yet**.

The canonical v2.8 candidate is:

`spec/versions/v2.8/HYPER-QUANT_MASTER_SPEC_v2.8.md`

The v2.7 specification remains preserved as the prior review artifact.

The `spec/master/` directory will contain the approved canonical master only after the review matrix, document identity, Definition of Done, and independent adversarial review all close successfully.

## What this project is

HYPER-QUANT is a quantitative research and execution platform rather than a single trading bot. Its design covers:

- durable market and account-data capture,
- event-driven replay and research,
- hypothesis and research-trial governance,
- backtesting and execution simulation,
- statistical validation and anti-overfitting controls,
- conditional probability and expected-value analysis,
- capital allocation and risk management,
- AI-assisted research under strict isolation,
- staged deployment from research to production,
- safety-constrained execution and reconciliation,
- auditability and iterative adversarial review.

The economic objective is **empirical net-positive expectancy after realistic costs**, followed by safe capital growth when the evidence justifies additional allocation.

## Research philosophy

The program deliberately does not assume that an individual trader can reproduce institutional HFT economics. Discovery priority therefore favors retail-accessible and structurally testable mechanisms before pure short-horizon prediction:

1. Structural / venue-specific effects
2. Financing / funding / basis effects
3. Cross-venue informational effects
4. Microstructure / short-horizon effects
5. Mean-reversion baseline as a falsification and continuity benchmark

A research result of **NO_TRADE** is a valid and valuable outcome.

## Repository map

```text
hyper-quant/
├── README.md
├── LICENSE
├── SECURITY.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── .gitignore
├── spec/
│   ├── master/
│   │   └── README.md
│   ├── versions/
│   │   ├── v2.7/
│   │   │   └── HYPER-QUANT_MASTER_SPEC_v2.7.md
│   │   └── v2.8/
│   │       └── HYPER-QUANT_MASTER_SPEC_v2.8.md
│   ├── annex/
│   │   └── statistical-methods-v1.md
│   └── reviews/
│       ├── v2.7/
│       │   └── v2.7-adversarial-review.md
│       └── v2.8/
│           └── v2.8-adversarial-review.md
├── docs/
│   ├── architecture.md
│   ├── research-lifecycle.md
│   └── deployment-gates.md
├── research/
│   └── README.md
├── src/
│   ├── README.md
│   └── execution/
│       ├── barrier.ts
│       ├── intent-journal.ts
│       ├── intent-state-machine.ts
│       ├── mutation-coordinator.ts
│       ├── reconciliation.ts
│       └── safety-authority.ts
├── tests/
│   ├── README.md
│   ├── adversarial/
│   │   ├── deterministic-barrier.ts
│   │   ├── intent-contracts.test.ts
│   │   └── toctou-kill-race.test.ts
│   └── unit/
│       └── spec-status.test.ts
├── scripts/
│   └── run-tests.mjs
├── tsconfig.prod.json
├── tsconfig.json
├── configs/
│   ├── README.md
│   └── .env.example
└── .github/
    ├── CODEOWNERS
    ├── workflows/
    │   └── ci.yml
    └── ISSUE_TEMPLATE/
        ├── bug_report.md
        ├── research_hypothesis.md
        └── security_issue.md
```

## Safety boundary

Never commit API keys, private keys, seed phrases, exchange credentials, personal account exports, production secrets, or unredacted sensitive logs.

Production signing material is intentionally outside the research/AI plane. The execution safety scaffold is non-live; see `SECURITY.md` and the v2.8 specification for the normative controls.

## License

This repository is released under **GNU General Public License v3.0 or later (GPL-3.0-or-later)** unless a future file explicitly carries a different notice.

See `LICENSE`.

## Disclaimer

HYPER-QUANT is software and research infrastructure, not financial advice. Trading can result in partial or total loss of capital. No strategy, backtest, simulation, model, or specification in this repository guarantees profit, returns, or loss avoidance.

## Implementation status

The TypeScript scaffold is intentionally non-trading and non-signing while the specification remains under review. No exchange order submission is implemented in this repository scaffold.
