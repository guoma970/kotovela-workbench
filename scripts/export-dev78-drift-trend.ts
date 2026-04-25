import fs from 'node:fs'
import path from 'node:path'
import { buildEvidenceDriftSummary, buildEvidenceRow, listTopUnresolvedExamplesByBucket, type EvidenceRow } from '../src/lib/evidenceAcceptance'
import { inferTaskBoardEvidenceContext, type StableEvidenceRoutingHints } from '../src/lib/evidenceContext'
import type { Agent, Project, Room, Task } from '../src/types'

const root = path.resolve('.')
const publicDir = path.join(root, 'public', 'evidence', 'dev78')
const evidenceDir = path.join(root, '.evidence', 'dev78')
fs.mkdirSync(publicDir, { recursive: true })
fs.mkdirSync(evidenceDir, { recursive: true })

const normalize = (value?: string) => String(value ?? '').trim()

const projects: Project[] = [{ id: 'project-1', code: 'PRJ-1', name: '言町科技工作台', owner: 'builder', ownerAgentId: 'agent-2', status: 'active', progress: 88, focus: 'bucket unresolved examples export', blockers: 0, stage: 'delivery', nextStep: 'attach top unresolved examples to drift export', taskCount: 1, roomIds: ['room-2'] }]
const agents: Agent[] = [{ id: 'agent-2', code: 'AG-2', name: 'builder', role: 'builder', status: 'active', currentTask: 'DEV-78', project: '言町科技工作台', projectId: 'project-1', updatedAt: new Date().toISOString(), instanceKey: 'builder' }]
const rooms: Room[] = [{ id: 'room-2', code: 'ROOM-2', name: '言町科技运营群', status: 'active', focus: 'bucket unresolved examples export', pending: 0, channelType: 'feishu', instance: 'builder', instanceIds: ['agent-2'], mainProject: '言町科技工作台', mainProjectId: 'project-1', purpose: 'route review', recentAction: 'DEV-78 drift export' }]
const tasks: Task[] = [{ id: 'task-2', code: 'TASK-2', title: 'bucket unresolved examples export', project: '言町科技工作台', projectId: 'project-1', assignee: 'builder', assigneeAgentId: 'agent-2', executor: 'builder', executorAgentId: 'agent-2', status: 'doing', priority: 'high', updatedAt: new Date().toISOString() }]

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
  projectId?: string
  agentId?: string
  roomId?: string
  taskId?: string
  routingHints?: StableEvidenceRoutingHints
}

function pushEvidenceRow(result: EvidenceRow[], row: { id: string; source: 'tasks-board' | 'leads'; title: string; detail: string; timestamp: string; textParts: string[]; signalParts: string[]; projectId?: string; agentId?: string; roomId?: string; taskId?: string; routingHints?: StableEvidenceRoutingHints }) {
  result.push(buildEvidenceRow(row, { projects, agents, rooms, tasks }))
}

function buildRowsFromBoard(board: BoardEntry[]): EvidenceRow[] {
  const result: EvidenceRow[] = []

  board.slice(0, 32).forEach((entry, entryIndex) => {
    ;(entry.decision_log ?? []).slice(-2).forEach((log, logIndex) => {
      const evidenceContext = inferTaskBoardEvidenceContext(entry)
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
        projectId: entry.projectId ?? evidenceContext.projectId,
        agentId: entry.agentId ?? evidenceContext.agentId,
        roomId: entry.roomId ?? evidenceContext.roomId,
        taskId: entry.taskId ?? evidenceContext.taskId,
        routingHints: entry.routingHints ?? evidenceContext.routingHints,
      })
    })
  })

  board
    .filter((entry) => entry.domain === 'business' || entry.lead_id || entry.consultant_id || String(entry.task_name ?? entry.title ?? '').includes('客户'))
    .slice(0, 32)
    .forEach((entry, entryIndex) => {
      ;(entry.decision_log ?? []).slice(-2).forEach((log, logIndex) => {
        const evidenceContext = inferTaskBoardEvidenceContext(entry)
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
          projectId: entry.projectId ?? evidenceContext.projectId,
          agentId: entry.agentId ?? evidenceContext.agentId,
          roomId: entry.roomId ?? evidenceContext.roomId,
          taskId: entry.taskId ?? evidenceContext.taskId,
          routingHints: entry.routingHints ?? evidenceContext.routingHints,
        })
      })
    })

  return result
}

const stabRoot = path.join(root, '.tmp')
const timeline = fs.readdirSync(stabRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('stab-'))
  .map((entry) => ({ name: entry.name, file: path.join(stabRoot, entry.name, 'tasks-board.json') }))
  .filter((entry) => fs.existsSync(entry.file))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((entry) => {
    const payload = JSON.parse(fs.readFileSync(entry.file, 'utf8'))
    const board = Array.isArray(payload.board) ? payload.board : []
    const rows = buildRowsFromBoard(board)
    const bucketCounts = rows.reduce<Record<string, number>>((acc, row) => {
      if (!row.structuredSplitSource) return acc
      acc[row.structuredSplitSource] = (acc[row.structuredSplitSource] ?? 0) + 1
      return acc
    }, {})
    return {
      sampleId: entry.name,
      timestamp: payload.generated_at ?? '',
      sourceFile: path.relative(root, entry.file),
      rows,
      unresolved: rows.filter((row) => !row.success).length,
      bucketCounts,
    }
  })

if (!timeline.length) throw new Error('No .tmp/stab-*/tasks-board.json found in repo')

const milestoneSamples = timeline.filter((sample, index, list) => {
  if (index === 0 || index === list.length - 1) return true
  const prev = list[index - 1]
  return ['signal_map_account', 'signal_map_room', 'signal_map_content'].some((key) => (sample.bucketCounts[key] ?? 0) !== (prev.bucketCounts[key] ?? 0)) || sample.unresolved !== prev.unresolved
})

const recentMilestones = milestoneSamples.slice(-6).map((sample, index) => ({ ...sample, label: `round-${index + 1}` }))
const summary = buildEvidenceDriftSummary(recentMilestones.map(({ sampleId, label, timestamp, rows }) => ({ sampleId, label, timestamp, rows })), {
  countThreshold: 2,
  ratioThreshold: 0.2,
  criticalCountThreshold: 3,
  criticalRatioThreshold: 0.34,
})

const latestSample = recentMilestones.at(-1)
if (!latestSample) throw new Error('No recent milestone sample available for DEV-78 export')

const topExamples = listTopUnresolvedExamplesByBucket(latestSample.rows, { topN: 5 })

const enriched = {
  generated_at: new Date().toISOString(),
  selection: 'milestone_samples_by_bucket_change_or_unresolved_change',
  latest_sample: {
    sampleId: latestSample.sampleId,
    label: latestSample.label,
    timestamp: latestSample.timestamp,
    sourceFile: latestSample.sourceFile,
    unresolved_rows: latestSample.unresolved,
  },
  source_files: recentMilestones.map(({ sampleId, sourceFile, timestamp, unresolved, bucketCounts }) => ({ sampleId, sourceFile, timestamp, unresolved_rows: unresolved, bucket_counts: bucketCounts })),
  threshold: { count: 2, ratio: 0.2, critical_count: 3, critical_ratio: 0.34 },
  top_examples_limit: 5,
  bucket_top_examples: topExamples,
  ...summary,
}

fs.writeFileSync(path.join(publicDir, 'drift-trend.json'), JSON.stringify(enriched, null, 2))
fs.writeFileSync(path.join(evidenceDir, 'dev78-drift-trend.json'), JSON.stringify(enriched, null, 2))
console.log(`Exported DEV-78 drift trend to ${path.relative(root, path.join(evidenceDir, 'dev78-drift-trend.json'))}`)
console.log(JSON.stringify({
  latest_sample: enriched.latest_sample,
  signal_map_room_examples: enriched.bucket_top_examples.signal_map_room.length,
  signal_map_content_examples: enriched.bucket_top_examples.signal_map_content.length,
}, null, 2))
