# Contributing

## Core principle

A change is not complete merely because code works locally. Changes must preserve specification identity, research integrity, execution safety, and reproducibility.

## Specification changes

Specification changes must identify:

- the affected version,
- the invariant or requirement being changed,
- the reason for the change,
- validation evidence,
- review impact,
- whether a new adversarial review cycle is required.

Do not silently edit an approved master in place. Create a versioned change and update the review record.

## Research changes

Empirical work must be registered before running. Research results must remain traceable to their receipt, dataset identity, configuration, code/artifact identity, and evaluation window.

## Security-sensitive changes

Changes touching signing, order submission, reconciliation, kill-switches, production networking, credential handling, or deployment gates require explicit security review.

## Pull requests

A PR should explain the behavior change, evidence, test coverage, and any change in risk posture. Large mixed-scope changes are discouraged.
