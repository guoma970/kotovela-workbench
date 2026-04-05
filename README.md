# Kotovela Workbench

A visual cockpit for multi-agent collaboration.

Track agent status, blockers, tasks, and collaboration flows in one place.

> Supports both demo (mock) and internal (real data) runtime modes.

---

> Designed for fast understanding of multi-agent systems in under 10 seconds.

---

![Cover](./public/screenshots/cover.png)

---

## Why this project

When multiple agents collaborate, it becomes difficult to answer simple but critical questions:

- Which agent is currently blocked?
- What is actively moving?
- Where is the work actually happening?
- How are tasks connected to projects and teams?
- What should be handled next?

Without a clear view, coordination becomes slow, fragmented, and reactive.

---

## What this project does

Kotovela Workbench provides a unified cockpit to:

- Visualize agent activity in real time
- Surface blockers and decision points
- Connect tasks, projects, and collaboration channels
- Help you quickly understand and act on the system state

---

## System Overview

Dashboard → Projects → Rooms → Tasks → Agents

![Overview](./public/screenshots/overview.png)

- **Dashboard** — global overview of blockers and activity
- **Projects** — project routing and ownership
- **Rooms** — collaboration channels where work happens
- **Tasks** — execution units and blocker tracking
- **Agents** — who is doing what

---

## Screenshots

### Dashboard
See blockers, active agents, and recent updates at a glance  
![Dashboard](./public/screenshots/dashboard.png)

### Agents
Track agent status and assignments in real time  
![Agents](./public/screenshots/agents.png)

### Tasks
Inspect tasks, priorities, and blocker details  
![Tasks](./public/screenshots/tasks.png)

### Projects
Understand project structure and ownership  
![Projects](./public/screenshots/projects.png)

### Rooms
Follow collaboration channels and active contexts  
![Rooms](./public/screenshots/rooms.png)

---

## Design Principles

- **Agent-first** — focus on what each agent is doing
- **Blocker-first** — surface what needs attention
- **Linked context** — connect tasks, projects, and rooms
- **Fast scanning** — understand system state in seconds
- **Action-oriented** — reduce path from insight to action

---

## Use Cases

- Multi-agent orchestration dashboards
- AI workflow monitoring
- Internal operation cockpits
- Task coordination systems
- Team collaboration visualization

---

## Quick Start

```bash
git clone https://github.com/yourname/kotovela-workbench.git
cd kotovela-workbench
npm install
```

**Demo vs Internal** — same codebase; Vite loads `.env.demo` or `.env.internal` via `--mode` (see `VITE_MODE`, `VITE_DATA_SOURCE`, etc.).

| Environment | npm scripts | Notes |
|-------------|-------------|--------|
| Demo (mock, public-facing) | `npm run dev:demo` · `npm run build:demo` | Deploy: [kotovela-workbench.vercel.app](https://kotovela-workbench.vercel.app/) |
| Internal (OpenClaw data) | `npm run dev:internal` · `npm run build:internal` | Deploy: [kotovela-internal.vercel.app](https://kotovela-internal.vercel.app) |

- **Dev server:** `http://localhost:5173` (strict port; only one of Demo/Internal dev at a time unless you change the port).
- **Preview (static dist):** `http://localhost:4173` — run `npm run build:demo` or `npm run build:internal` first, then `npm run preview`. For Internal local verification, **4173 is the preferred preview port** (aligned with earlier milestone evidence); avoid running Demo preview on 4173 at the same time.

**Builder workspace path (local):** `/Users/ztl/.openclaw/workspace-builder/kotovela-workbench` — adjust if your clone lives elsewhere.

**Mock Data**

Demo and fallbacks use in-repo TypeScript mock modules (e.g. `src/data/mockData.ts`) and the office-instances adapter (`src/data/officeInstancesAdapter.ts`). Replace or extend via `VITE_DATA_SOURCE` and API paths in `.env.*`.

---

## Roadmap

- [ ] Lightweight personal control mode (agent-first view)
- [ ] Enhanced blocker visualization
- [ ] Real-time updates (WebSocket / API)
- [ ] Actionable task operations
- [ ] External integrations (GitHub / Feishu / custom APIs)

---

## License

MIT