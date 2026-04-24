import fs from 'node:fs'
import path from 'node:path'
import { buildEvidenceParserFixtureDataset, summarizeFixtureDataset } from '../src/lib/evidenceAcceptance'
import type { Agent, Project, Room, Task } from '../src/types'

const root = path.resolve('.')
const outDir = path.join(root, '.evidence', 'dev73')
fs.mkdirSync(outDir, { recursive: true })

const projects: Project[] = [
  {
    id: 'project-1',
    code: 'PRJ-1',
    name: '言町科技工作台',
    owner: 'builder',
    ownerAgentId: 'agent-2',
    status: 'active',
    progress: 82,
    focus: 'evidence acceptance',
    blockers: 0,
    stage: 'delivery',
    nextStep: 'close parser fixtures',
    taskCount: 1,
    roomIds: ['room-2'],
  },
]

const agents: Agent[] = [
  {
    id: 'agent-2',
    code: 'AG-2',
    name: 'builder',
    role: 'builder',
    status: 'active',
    currentTask: 'DEV-73',
    project: '言町科技工作台',
    projectId: 'project-1',
    updatedAt: '2026-04-24T19:34:00+08:00',
    instanceKey: 'builder',
  },
]

const rooms: Room[] = [
  {
    id: 'room-2',
    code: 'ROOM-2',
    name: '言町科技运营群',
    status: 'active',
    focus: 'content routing',
    pending: 0,
    channelType: 'feishu',
    instance: 'builder',
    instanceIds: ['agent-2'],
    mainProject: '言町科技工作台',
    mainProjectId: 'project-1',
    purpose: 'route review',
    recentAction: 'parser triage',
  },
]

const tasks: Task[] = [
  {
    id: 'task-2',
    code: 'TASK-2',
    title: 'material case routing',
    project: '言町科技工作台',
    projectId: 'project-1',
    assignee: 'builder',
    assigneeAgentId: 'agent-2',
    executor: 'builder',
    executorAgentId: 'agent-2',
    status: 'doing',
    priority: 'high',
    updatedAt: '2026-04-24T19:34:00+08:00',
  },
]

const rows = buildEvidenceParserFixtureDataset({ projects, agents, rooms, tasks })
const summary = summarizeFixtureDataset(rows)
const mismatches = rows
  .filter(({ fixture, row }) => fixture.expectation.category !== row.category || fixture.expectation.reason !== row.reason || fixture.expectation.success !== row.success || fixture.expectation.match_source !== row.matchSource || fixture.expectation.match_confidence !== row.matchConfidence)
  .map(({ fixture, row }) => ({ id: fixture.id, expected: fixture.expectation, actual: { category: row.category, reason: row.reason, success: row.success, match_source: row.matchSource, match_confidence: row.matchConfidence } }))

fs.writeFileSync(
  path.join(outDir, 'parser-fixture-dataset.json'),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      rows: rows.map(({ fixture, row }) => ({ fixture, row })),
      summary,
      mismatches,
    },
    null,
    2,
  ),
)

console.log(`Exported parser fixture dataset to ${path.relative(root, path.join(outDir, 'parser-fixture-dataset.json'))}`)
