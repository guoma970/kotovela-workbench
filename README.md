# Kotovela Workbench

**A visual cockpit for multi-agent collaboration.**

Track agent status, blockers, task flows, project routing, and collaboration rooms in one place.

面向多实例协作的可视化驾驶舱：看状态、看阻塞、看动态、看承接关系。

---

![Kotovela Workbench](screenshots/dashboard.png)

---

## Why this project

When multiple agents collaborate, it becomes hard to answer:

- **Which agent is currently blocked?**
- **What is actively moving?**
- **Which task belongs to which project?**
- **Where is collaboration actually happening?**
- **What should be handled next?**

Kotovela Workbench exists to make the invisible visible — giving you a single pane of glass over a living system of agents, tasks, rooms, and projects.

---

## Core Views

| View | What it answers |
|------|----------------|
| **Dashboard** | Global situation — blockers, active agents, recent updates |
| **Projects** | Project routing and ownership — who owns what |
| **Rooms** | Collaboration channels and active contexts |
| **Tasks** | Execution units and blocker tracking |
| **Agents** | Agent status, assignment, and availability |

---

## Screenshots

### Dashboard
*See blockers, active agents, and recent updates at a glance.*

![Dashboard](screenshots/dashboard.png)

### Agents
*Track who is doing what, who is blocked, and who is available.*

![Agents](screenshots/agents.png)

### Tasks
*Inspect execution details and blocker reasons.*

![Tasks](screenshots/tasks.png)

### Projects
*Understand project routing, ownership, and current focus.*

### Rooms
*Follow where collaboration is happening and what each room is carrying.*

---

## Design Principles

- **Agent-first** — agents are the primary unit, not tasks or projects
- **Blocker-first** — surface what's stuck before what's moving
- **Linked context** — clicking anything cross-links to related agents, tasks, rooms, and projects
- **Fast scanning** — dense but hierarchical; status visible at a glance
- **Action-oriented structure** — every view points toward the next decision

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Type check and build
npm run build

# Preview production build (http://localhost:4173)
npm run preview

# Lint
npm run lint
```

> **Note:** This project ships with mock data for demonstration and development. Swap in your live data source when ready.

---

## Mock Data

This project ships with mock data covering agents, projects, rooms, and tasks. The default setup is intended for demo and development use.

---

## Roadmap

- [ ] **Lightweight personal control mode** — solo operator view with fewer chrome
- [ ] **Better blocker visualization** — richer cause-chain and impact propagation
- [ ] **Real-time event stream** — live feed of agent actions and state changes
- [ ] **Action-oriented task handling** — take action directly from the task view
- [ ] **External integrations** — connect to OpenClaw sessions, LLMs, and team tools

---

## License

MIT
