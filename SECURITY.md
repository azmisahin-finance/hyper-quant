# Security Policy

## Scope

HYPER-QUANT treats signing authority, exchange credentials, account state, deployment artifacts, and research integrity as security-sensitive.

## Never commit

- API keys or secrets
- private keys or seed phrases
- wallet files
- production credential exports
- unredacted account statements
- sensitive personal information
- production infrastructure credentials

## Report a vulnerability

For a public repository, do not disclose exploitable credential or execution vulnerabilities in a public issue. Use the repository's private security reporting channel when enabled by the maintainers.

Until a private channel is configured, provide only non-sensitive reproduction details to the maintainers and do not include live credentials.

## Security principles

The execution signer is isolated from the research/AI plane. Research and AI components must not receive signer authority. Unknown exchange outcomes must trigger reconciliation rather than assumptions about exposure. Safety-triggered shutdowns must not silently auto-resume.
