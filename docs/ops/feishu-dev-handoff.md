# Feishu Dev Handoff (Public Demo)

This document describes the public-safe handoff pattern for Kotovela Hub demos. It intentionally does **not** contain private Feishu `chat_id` values, internal group names, agent IDs, or operational credentials.

## Scope

- Brand/product demo: `Kotovela Hub`
- Repository: this workspace/repository
- Channel model: a Feishu group or other team chat can be configured by the deploying team

## Demo placeholders

Use placeholders in public docs and examples:

- Primary research chat: `<FEISHU_CHAT_ID_KOTOVELA_HUB>`
- Legacy/history chat: `<FEISHU_CHAT_ID_LEGACY>`
- Main coordinator account: `<MAIN_AGENT>`
- Builder/executor account: `<BUILDER_AGENT>`

Do not publish real `oc_*` IDs. Keep production IDs in local environment/configuration outside the OSS repository.

## Handoff flow

1. A requester posts the development request in the configured project chat.
2. The coordinator clarifies scope and assigns implementation/review work.
3. The executor replies with `doing`, then returns evidence: changed files, commands, gate results, and blockers.
4. Release notes include only public-safe task IDs and sanitized summaries.

## Runtime notes

- `office-api` may show live sessions when a local operator exposes it intentionally.
- Public builds should render demo-safe labels if no private runtime mapping is configured.
- Any runtime audit logs, generated test results, screenshots, or local evidence should stay out of the release diff unless explicitly converted to fixtures.

## Release requirement

Before publishing, run the release gates from `docs/ops/release-candidate-checklist.md` and confirm that searching for real Feishu IDs (`oc_*`) returns no private identifiers in candidate files.
