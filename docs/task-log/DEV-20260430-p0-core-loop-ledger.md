# DEV-20260430 P0 Core Loop Ledger

- project: Kotovela Hub / 言町驾驶舱
- repo: `/Users/ztl/.openclaw/workspace-builder/kotovela-workbench`
- branch target: `feature/snapshot-sync-ready`
- scope freeze: no new product features; only refactor, bug fix, test coverage, stability
- P0 path: consultant login -> invite generation -> customer questionnaire -> proposal output -> evidence receipt
- first small step: establish static ledger and review input; no product-code change because login / invite / questionnaire / proposal route is not yet exposed in the current tracked React routes.

## Static location summary

Current tracked app routes from `src/App.tsx`:

- `/` -> `src/pages/DashboardPage.tsx`
- `/agents` -> `src/pages/AgentsPage.tsx`
- `/projects` -> `src/pages/ProjectsPage.tsx`
- `/tasks` -> `src/pages/TasksPage.tsx`
- `/leads` -> `src/pages/LeadsPage.tsx`
- `/rooms` -> `src/pages/RoomsPage.tsx`
- `/scheduler` -> `src/pages/AutoTasksPage.tsx`
- `/consultants` -> `src/pages/ConsultantsPage.tsx`
- `/model-usage` -> `src/pages/ModelUsagePage.tsx`
- `/system-control` -> `src/pages/SystemControlPage.tsx`
- `/evidence-acceptance` -> `src/pages/EvidenceAcceptancePage.tsx`

Current API / local server entrypoints observed:

- `api/office-instances.ts`
- `scripts/office-api-server.ts`
- frontend fetches observed in P0-adjacent pages: `/api/tasks-board`, `/api/audit-log`, `/api/system-mode`, `/api/leads`

## P0 module decomposition

| Module | Entry / route | Component / API | Test status | Current risk | Next smallest action |
| --- | --- | --- | --- | --- | --- |
| 1. 顾问端登录 | No dedicated `/login` / `/auth` route in `src/App.tsx`; closest route is `/consultants` | `src/pages/ConsultantsPage.tsx`; config in `src/config/consultantSettings.ts`; system mode from `/api/system-mode` | Covered only indirectly by stabilization suite business/consultant cases; no login/auth fixture found in current route table | P0 starts before existing app boundary; cannot verify consultant identity/session, role, or guarded access | Define existing login contract first: route, session source, success/failure state, and auth guard evidence; do not implement broad auth without spec |
| 2. Invite 生成 | No dedicated invite route in `src/App.tsx`; P0-adjacent lead routing through `/leads` and scheduler | `src/pages/LeadsPage.tsx`; scheduler POST to `/api/tasks-board`; consultant fields from board/leads | Existing `npm test` includes business lead creation, consultant assignment, lead stats/list endpoint checks | Invite token uniqueness, expiry, consultant binding, and audit trail are not visible as explicit objects | Add static contract/test fixture once invite object exists; minimum fields: invite_id/token_hash, consultant_id, lead_id, expires_at, status, audit log |
| 3. 客户问卷 | No dedicated questionnaire route in `src/App.tsx` | Not observed as component/API in tracked route table | No direct questionnaire test coverage | Customer answers, validation, partial save, and lead binding are unverified | Locate or introduce only a test contract after product owner confirms route/API; avoid adding UI feature ad hoc |
| 4. 建议书输出 | No dedicated proposal route in `src/App.tsx` | Not observed as component/API in tracked route table; possible future linkage to content/proposal artifacts | Current stabilization suite verifies content/business routing, not proposal output | Proposal generation may mix content output with sales proposal; evidence object boundaries unclear | Define proposal artifact schema and acceptance evidence before implementation |
| 5. Evidence 记录与回执 | `/evidence-acceptance` | `src/pages/EvidenceAcceptancePage.tsx`; libs `src/lib/evidenceAcceptance.ts`, `src/lib/evidenceContext.ts`; evidence artifacts under `.evidence/`, `public/evidence/`, `docs/task-log/` | Existing stabilization suite passes 32/32; parser fixture output exists | P0-specific evidence IDs are absent; current evidence is platform/stabilization-focused | Use this ledger as P0 anchor; next changes should append P0-specific build/test/screenshot/JSON/commit evidence |

## Review brief for Claude Code / review agent

### Scope

Review only private Kotovela Hub / 言町驾驶舱 in:

- `/Users/ztl/.openclaw/workspace-builder/kotovela-workbench`
- branch: `feature/snapshot-sync-ready`

Focus P0 chain only:

1. consultant login
2. invite generation
3. customer questionnaire
4. proposal output
5. evidence receipt / acceptance

### Files to start from

- `src/App.tsx` route map
- `src/layout/AppShell.tsx` nav / shell guard behavior
- `src/pages/ConsultantsPage.tsx`
- `src/config/consultantSettings.ts`
- `src/pages/LeadsPage.tsx`
- `src/pages/EvidenceAcceptancePage.tsx`
- `src/lib/evidenceAcceptance.ts`
- `src/lib/evidenceContext.ts`
- `scripts/run-stabilization-suite.mjs`
- `api/office-instances.ts`
- `scripts/office-api-server.ts`
- relevant evidence logs under `docs/task-log/` and `.evidence/dev78/` if present

### Key risks to inspect

- Whether any consultant-facing route is protected by identity/session state.
- Whether internal vs opensource mode prevents private consultant/customer data leakage.
- Whether invite/token objects exist and are auditable.
- Whether questionnaire answers have validation, persistence, and lead/consultant linkage.
- Whether proposal output is a first-class artifact rather than a content task side effect.
- Whether every P0 transition emits machine-readable evidence and audit log.
- Whether tests cover negative cases: unauthorized, expired invite, malformed questionnaire, missing proposal source data.

### Forbidden / out of scope

- Do not add new product features during review.
- Do not push to or sync with public `guoma970/openclaw-kotovela`.
- Do not rotate tokens, delete data, or run destructive cleanup.
- Do not broaden scope to scheduler/content modules except where they intersect P0 evidence.

### Expected report format

1. Findings sorted by severity.
2. For each finding: file/path, behavior risk, reproduction or static evidence, recommended minimal fix, missing test.
3. Separate section for P0 coverage matrix.
4. Separate section for verification commands and outputs.

## Intended changes for this step

- Add this ledger file only: `docs/task-log/DEV-20260430-p0-core-loop-ledger.md`.
- Purpose: create the P0 workbench anchor, freeze scope, document current route/API absence, and provide review-agent input.
- No source code or product UI changes in this step, because the current route table does not expose login/invite/questionnaire/proposal modules and adding them would be a new feature.

## Verification snapshot

Command run before writing this ledger:

```sh
npm test
```

Observed output summary:

```json
{
  "task_id": "DEV-20260416-44",
  "run_id": "stab-1777483620821",
  "generated_at": "2026-04-29T17:27:03.977Z",
  "total_cases": 32,
  "pass": 32,
  "fail": 0,
  "failed_modules": [],
  "build_status": "pass",
  "commit_message": "fix: close stabilization blockers for launch candidate"
}
```

Notes:

- This verifies the existing stabilization suite, not P0-specific login/invite/questionnaire/proposal behavior.
- No screenshot/DOM capture was taken in this step; the change is documentation-only and no dev server was started.
- No commit was created in this step.
