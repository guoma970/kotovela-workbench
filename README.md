# OpenClaw × Kotovela

Public-safe, mock-only showcase for a multi-agent collaboration cockpit.

This public repository contains only synthetic demo capabilities. Private execution systems, live runtime code, real credentials, local private paths, and workspace payloads are not included here.

## Demo

https://openclaw-kotovela.vercel.app

## What is included

- React/Vite dashboard showcase
- Mock collaboration flows
- Dry-run examples
- Public documentation
- Guardrails that keep private runtime code out of the public repository

## What is not included

- Production execution logic
- Real Feishu/GitHub sync credentials
- Customer data
- Private execution automation
- Scheduler, Consultants, System Control, or Evidence Acceptance internals

---

## Public-safe scope

This repository intentionally stays public-safe and mock-only. Run `bash validate_repo.sh` before opening a pull request.

Dashboard → Projects → Rooms → Tasks → Agents

![Cover](./public/screenshots/cover.png)

---

## Why this project

When multiple agents collaborate, it becomes difficult to answer simple but critical questions:

- Which agent is currently blocked?
- What is actively moving?
- Where is the work actually happening?
- How are tasks connected to projects and teams?
- What should be handled next?

OpenClaw × Kotovela provides a visual dashboard to make those coordination states easier to scan and discuss.

---

## Screenshots

### Dashboard
See blockers, active agents, and recent updates at a glance.

![Dashboard](./public/screenshots/dashboard.png)

### Agents
Track agent status and assignments in demo mode.

![Agents](./public/screenshots/agents.png)

### Tasks
Inspect mock tasks, priorities, and blocker details.

![Tasks](./public/screenshots/tasks.png)

### Projects
Understand project structure and ownership.

![Projects](./public/screenshots/projects.png)

### Rooms
Follow collaboration channels and active contexts.

![Rooms](./public/screenshots/rooms.png)

---

## Quick Start

```bash
git clone https://github.com/guoma970/openclaw-kotovela.git
cd openclaw-kotovela
npm install
npm run dev
```

## Verification

```bash
bash scripts/guard-public-baseline.sh
npm run lint
npm run build
```

## License

MIT
