import fs from 'node:fs'
import path from 'node:path'
import { buildEvidenceDriftSummary, buildEvidenceRow, type EvidenceRow } from '../src/lib/evidenceAcceptance'
import type { Agent, Project, Room, Task } from '../src/types'

const root = path.resolve('.')
const publicDir = path.join(root, 'public', 'evidence', 'dev76')
const evidenceDir = path.join(root, '.evidence', 'dev76')
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
    progress: 86,
    focus: 'structured split evidence',
    blockers: 0,
    stage: 'delivery',
    nextStep: 'lock drift source from stable samples',
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
    currentTask: 'DEV-76',
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
    focus: 'split drift triage',
    pending: 0,
    channelType: 'feishu',
    instance: 'builder',
    instanceIds: ['agent-2'],
    mainProject: '言町科技工作台',
    mainProjectId: 'project-1',
    purpose: 'route review',
    recentAction: 'structured split trace export',
  },
]

const tasks: Task[] = [
  {
    id: 'task-2',
    code: 'TASK-2',
    title: 'structured split drift export',
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
  title?: string
  lead_id?: string
  domain?: string
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
  attribution?: { source?: string; medium?: string; campaign?: string; content?: string }
  decision_log?: Array<{ action?: string; reason?: string; detail?: string; timestamp?: string }>
  updated_at?: string
  timestamp?: string
}

function pushEvidenceRow(result: EvidenceRow[], row: { id: string; source: 'tasks-board' | 'leads'; title: string; detail: string; timestamp: string; textParts: string[]; signalParts: string[] }) {
  result.push(buildEvidenceRow(row, { projects, agents, rooms, tasks }))
}

function buildRowsFromBoard(board: BoardEntry[]): EvidenceRow[] {
  const result: EvidenceRow[] = []

  board.slice(0, 24).forEach((entry, entryIndex) => {
    ;(entry.decision_log ?? []).slice(-2).forEach((log, logIndex) => {
      pushEvidenceRow(result, {
        id: `task-${entryIndex}-${logIndex}`,
        source: 'tasks-board',
        title: entry.task_name ?? entry.title ?? `task-${entryIndex + 1}`,
        detail: `${log.action ?? '-'} · ${log.reason ?? '-'} · ${log.detail ?? '-'}`,
        timestamp: log.timestamp ?? entry.updated_at ?? entry.timestamp ?? '-',
        textParts: [entry.task_name ?? entry.title, log.action, log.reason, log.detail].map((item) => normalize(item)),
        signalParts: [
          entry.project_line ? `project_line=${entry.project_line}` : undefined,
          entry.source_line ? `source_line=${entry.source_line}` : undefined,
          entry.account_line ? `account_line=${entry.account_line}` : undefined,
          entry.content_line ? `content_line=${entry.content_line}` : undefined,
          entry.consultant_id ? `consultant_id=${entry.consultant_id}` : undefined,
          entry.assigned_agent,
          entry.agent,
          entry.route_target,
          entry.route_result,
        ].map((item) => normalize(item)),
      })
    })
  })

  board
    .filter((entry) => entry.domain === 'business' || entry.lead_id || entry.consultant_id || String(entry.task_name ?? entry.title ?? '').includes('客户'))
    .slice(0, 24)
    .forEach((entry, entryIndex) => {
      ;(entry.decision_log ?? []).slice(-2).forEach((log, logIndex) => {
        pushEvidenceRow(result, {
          id: `lead-${entryIndex}-${logIndex}`,
          source: 'leads',
          title: entry.task_name ?? entry.title ?? entry.lead_id ?? `lead-${entryIndex + 1}`,
          detail: `${log.action ?? '-'} · ${log.reason ?? '-'} · ${log.detail ?? '-'}`,
          timestamp: log.timestamp ?? entry.updated_at ?? entry.timestamp ?? '-',
          textParts: [entry.task_name ?? entry.title, entry.lead_id, log.action, log.reason, log.detail].map((item) => normalize(item)),
          signalParts: [
            entry.source_line ? `source_line=${entry.source_line}` : undefined,
            entry.account_line ? `account_line=${entry.account_line}` : undefined,
            entry.content_line ? `content_line=${entry.content_line}` : undefined,
            entry.consultant_id ? `consultant_id=${entry.consultant_id}` : undefined,
            entry.status,
            entry.attribution ? `attribution=${entry.attribution.source}/${entry.attribution.medium}/${entry.attribution.campaign}` : undefined,
            entry.attribution?.content,
          ].map((item) => normalize(item)),
        })
      })
    })

  return result
}

const stabRoot = path.join(root, '.tmp')
const timeline = fs
  .readdirSync(stabRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('stab-'))
  .map((entry) => ({
    name: entry.name,
    file: path.join(stabRoot, entry.name, 'tasks-board.json'),
  }))
  .filter((entry) => fs.existsSync(entry.file))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((entry) => {
    const payload = JSON.parse(fs.readFileSync(entry.file, 'utf8'))
    const board = Array.isArray(payload.board) ? payload.board : []
    const rows = buildRowsFromBoard(board)
    const structured = rows.filter((row) => row.structuredSplitSource).length
    return {
      sampleId: entry.name,
      timestamp: payload.generated_at ?? '',
      sourceFile: path.relative(root, entry.file),
      rows,
      structured,
      unresolved: rows.filter((row) => !row.success).length,
    }
  })

if (!timeline.length) throw new Error('No .tmp/stab-*/tasks-board.json found in repo')

const milestoneSamples = timeline.filter((sample, index, list) => {
  if (index === 0 || index === list.length - 1) return true
  const prev = list[index - 1]
  return sample.structured !== prev.structured || sample.unresolved !== prev.unresolved
})

const recentMilestones = milestoneSamples.slice(-6).map((sample, index) => ({
  ...sample,
  label: `round-${index + 1}`,
}))

const summary = buildEvidenceDriftSummary(recentMilestones.map(({ sampleId, label, timestamp, rows }) => ({ sampleId, label, timestamp, rows })), {
  countThreshold: 2,
  ratioThreshold: 0.2,
  criticalCountThreshold: 3,
  criticalRatioThreshold: 0.34,
})

const enriched = {
  generated_at: new Date().toISOString(),
  selection: 'milestone_samples_by_structured_split_or_unresolved_change',
  source_files: recentMilestones.map(({ sampleId, sourceFile, timestamp, structured, unresolved }) => ({ sampleId, sourceFile, timestamp, structured_split_rows: structured, unresolved_rows: unresolved })),
  threshold: {
    count: 2,
    ratio: 0.2,
    critical_count: 3,
    critical_ratio: 0.34,
  },
  ...summary,
}

fs.writeFileSync(path.join(publicDir, 'drift-trend.json'), JSON.stringify(enriched, null, 2))
fs.writeFileSync(path.join(evidenceDir, 'dev76-drift-trend.json'), JSON.stringify(enriched, null, 2))

console.log(`Exported DEV-76 drift trend to ${path.relative(root, path.join(evidenceDir, 'dev76-drift-trend.json'))}`)
