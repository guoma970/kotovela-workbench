# Public-safe Checklist

Use this checklist before pushing or publishing changes to `guoma970/openclaw-kotovela`.

## Repository positioning

- [ ] This repository stays a public-safe, mock-only OpenClaw × Kotovela showcase.
- [ ] README first screen states the public-safe/mock-only boundary and the canonical demo URL.
- [ ] CONTRIBUTING and SECURITY explain what must never be committed.
- [ ] No private runtime mode, live workspace adapter, or server/API endpoint is added.

## Required exclusions

The public repository must not contain:

- [ ] Real tokens, API keys, webhook secrets, OAuth credentials, or PATs.
- [ ] Real Feishu/Lark/OpenClaw chat IDs, open IDs, tenant IDs, or user IDs.
- [ ] Local private paths such as `/Users/<real-user>/...`.
- [ ] Private repository names, private product names, workspace-only runbooks, or live execution payloads.
- [ ] Private runtime files, private build scripts, live API/server code, or real-run fixtures.

## Validator

Run the guardrail locally before pushing:

```bash
bash validate_repo.sh
```

The GitHub Actions workflow at `.github/workflows/public-safe-validate.yml` runs the same check on pull requests and on pushes to `main`. If a pull request fails, the workflow comments the hit rules and risk lines on the PR while keeping the CI job failed.

## Acceptance statement

A public-safe review is complete only when you can say:

> No token / secret / private path / internal group ID / live API or server runtime / private Kotovela execution payload was found. README, SECURITY, CONTRIBUTING, scripts, docs, and config match the public-safe mock-only positioning.
