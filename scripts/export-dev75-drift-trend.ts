import fs from 'node:fs'
import path from 'node:path'
import { buildEvidenceDriftSummary, buildEvidenceRow, type EvidenceRow } from '../src/lib/evidenceAcceptance'
import type { Agent, Project, Room, Task } from '../src/types'

const root = path.resolve('.')
const publicDir = path.join(root, 'public', 'evidence', 'dev75')
const evidenceDir = path.join(root, '.evidence', 'dev75')
fs.mkdirSync(publicDir, { recursive: true })
fs.mkdirSync(evidenceDir, { recursive: true })

const normalize = (value?: string) => String(value ?? '').trim()

const projects: Project[] = [
  {
    id: 'project-1',
    code: 'PRJ-1',
    name: '言町科技工作台',
    owner: 'builder',
    ownerAgentId: 'agent-2',
    status: 'active',
    progress: 85,
    focus: 'heuristic drift alerting',
    blockers: 0,
    stage: 'delivery',
    nextStep: 'compare recent evidence samples',
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
    currentTask: 'DEV-75',
    project: '言町科技工作台',
    projectId: 'project-1',
    updatedAt: new Date().toISOString(),
    instanceKey: 'builder',
  },
]

const rooms: Room[] = [
  {
    id: 'room-2',
    code: 'ROOM-2',
    name: '言町科技运营群',
    status: 'active',
    focus: 'evidence drift triage',
    pending: 0,
    channelType: 'feishu',
    instance: 'builder',
    instanceIds: ['agent-2'],
    mainProject: '言町科技工作台',
    mainProjectId: 'project-1',
    purpose: 'route review',
    recentAction: 'heuristic sample compare',
  },
]

const tasks: Task[] = [
  {
    id: 'task-2',
    code: 'TASK-2',
    title: 'heuristic drift trend export',
    project: '言町科技工作台',
    projectId: 'project-1',
    assignee: 'builder',
    assigneeAgentId: 'agent-2',
    executor: 'builder',
    executorAgentId: 'agent-2',
    status: 'doing',
    priority: 'high',
    updatedAt: new Date().toISOString(),
  },
]

type BoardEntry = {
  task_name?: string
  status?: string
  project_line?: string
  source_line?: string
  account_line?: string
  content_line?: string
  consultant_id?: string
  assigned_agent?: string
  agent?: string
  route_target?: string
  route_result?: string
  decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
  updated_at?: string
  timestamp?: string
}

function buildRowsFromBoard(board: BoardEntry[]): EvidenceRow[] {
  const result: EvidenceRow[] = []
  const pushRow = (row: { id: string; source: 'tasks-board' | 'leads'; title: string; detail: string; timestamp: string; textParts: string[]; signalParts: string[] }) => {
    result.push(buildEvidenceRow(row, { projects, agents, rooms, tasks }))
  }

  board.slice(0, 24).forEach((entry, entryIndex) => {
    ;(entry.decision_log ?? []).slice(-2).forEach((log, logIndex) => {
      pushRow({
        id: `task-${entryIndex}-${logIndex}`,
        source: 'tasks-board',
        title: entry.task_name ?? `task-${entryIndex + 1}`,
        detail: `${log.action ?? '-'} · ${log.reason ?? '-'} · ${log.detail ?? '-'}`,
        timestamp: log.timestamp ?? entry.updated_at ?? entry.timestamp ?? '-',
        textParts: [entry.task_name, log.action, log.reason, log.detail].map((item) => normalize(item)),
        signalParts: [entry.project_line, entry.source_line, entry.account_line, entry.content_line, entry.consultant_id, entry.assigned_agent, entry.agent, entry.route_target, entry.route_result].map((item) => normalize(item)),
      })
    })

    ;(entry.decision_log ?? []).slice(-1).forEach((log, logIndex) => {
      pushRow({
        id: `lead-${entryIndex}-${logIndex}`,
        source: 'leads',
        title: entry.task_name ?? `lead-${entryIndex + 1}`,
        detail: `${log.action ?? '-'} · ${log.reason ?? '-'} · ${log.detail ?? '-'}`,
        timestamp: log.timestamp ?? entry.updated_at ?? entry.timestamp ?? '-',
        textParts: [entry.task_name, log.action, log.reason, log.detail].map((item) => normalize(item)),
        signalParts: [entry.source_line, entry.account_line, entry.content_line, entry.consultant_id, entry.status].map((item) => normalize(item)),
      })
    })
  })

  return result
}

const stabDirs = fs
  .readdirSync(path.join(root, '.tmp'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('stab-'))
  .map((entry) => ({
    name: entry.name,
    file: path.join(root, '.tmp', entry.name, 'tasks-board.json'),
  }))
  .filter((entry) => fs.existsSync(entry.file))
  .sort((a, b) => a.name.localeCompare(b.name))

const recent = stabDirs.slice(-4)
if (!recent.length) throw new Error('No .tmp/stab-*/tasks-board.json found in repo')

const samples = recent.map((entry, index) => {
  const payload = JSON.parse(fs.readFileSync(entry.file, 'utf8'))
  const board = Array.isArray(payload.board) ? payload.board : []
  const generatedAt = payload.generated_at ?? ''
  return {
    sampleId: entry.name,
    label: `round-${index + 1}`,
    timestamp: generatedAt,
    sourceFile: path.relative(root, entry.file),
    rows: buildRowsFromBoard(board),
  }
})

const summary = buildEvidenceDriftSummary(samples.map(({ sampleId, label, timestamp, rows }) => ({ sampleId, label, timestamp, rows })), {
  countThreshold: 2,
  ratioThreshold: 0.2,
  criticalCountThreshold: 3,
  criticalRatioThreshold: 0.34,
})

const enriched = {
  generated_at: new Date().toISOString(),
  source_files: samples.map(({ sampleId, sourceFile, timestamp }) => ({ sampleId, sourceFile, timestamp })),
  threshold: {
    count: 2,
    ratio: 0.2,
    critical_count: 3,
    critical_ratio: 0.34,
  },
  ...summary,
}

fs.writeFileSync(path.join(publicDir, 'drift-trend.json'), JSON.stringify(enriched, null, 2))
fs.writeFileSync(path.join(evidenceDir, 'dev75-drift-trend.json'), JSON.stringify(enriched, null, 2))

console.log(`Exported DEV-75 drift trend to ${path.relative(root, path.join(evidenceDir, 'dev75-drift-trend.json'))}`)
