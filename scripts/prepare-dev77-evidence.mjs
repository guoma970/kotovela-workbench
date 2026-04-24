import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const outDir = path.join(root, '.evidence', 'dev77')
fs.mkdirSync(outDir, { recursive: true })

const latestBoardFile = fs.readdirSync(path.join(root, '.tmp'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('stab-'))
  .map((entry) => path.join(root, '.tmp', entry.name, 'tasks-board.json'))
  .filter((file) => fs.existsSync(file))
  .sort()
  .at(-1)

if (!latestBoardFile) throw new Error('No .tmp/stab-*/tasks-board.json found in repo')

const tasksPayload = JSON.parse(fs.readFileSync(latestBoardFile, 'utf8'))
const auditPayload = JSON.parse(fs.readFileSync(path.join(root, 'server/data/audit-log.json'), 'utf8'))
const systemModeInternalPayload = JSON.parse(fs.readFileSync(path.join(root, 'server/data/system-mode.internal.json'), 'utf8'))
const systemModeOpenSourcePayload = JSON.parse(fs.readFileSync(path.join(root, 'server/data/system-mode.opensource.json'), 'utf8'))
const driftTrend = JSON.parse(fs.readFileSync(path.join(root, '.evidence', 'dev77', 'dev77-drift-trend.json'), 'utf8'))

const board = Array.isArray(tasksPayload.board) ? tasksPayload.board : []
const leads = board
  .filter((entry) => entry.domain === 'business' || entry.lead_id || entry.consultant_id || String(entry.task_name || '').includes('客户'))
  .slice(0, 24)
  .map((entry, index) => ({
    lead_id: entry.lead_id ?? `derived-lead-${index + 1}`,
    title: entry.task_name ?? `lead-${index + 1}`,
    status: entry.status ?? 'unknown',
    source: entry.source ?? entry.source_line ?? entry.account_line ?? 'derived_tasks_board',
    source_line: entry.source_line ?? entry.project_line ?? '',
    account_line: entry.account_line ?? '',
    content_line: entry.content_line ?? entry.attribution?.content ?? '',
    consultant_id: entry.consultant_id ?? '',
    attribution: entry.attribution ?? undefined,
    decision_log: (entry.decision_log ?? []).slice(-3),
  }))

const decisionEntries = board.flatMap((entry) =>
  (entry.decision_log ?? []).slice(-2).map((log) => ({
    task_name: entry.task_name ?? '-',
    action: log.action ?? '-',
    reason: log.reason ?? '-',
    detail: log.detail ?? '-',
    timestamp: log.timestamp ?? '-',
    project_line: entry.project_line ?? '',
    account_line: entry.account_line ?? '',
    source_line: entry.source_line ?? '',
    content_line: entry.content_line ?? '',
    consultant_id: entry.consultant_id ?? '',
  })),
).slice(0, 80)

const boardTriples = board.filter((entry) => entry.account_line && entry.source_line && entry.content_line)
const sameAccountDifferentSource = Object.entries(boardTriples.reduce((acc, entry) => {
  const account = entry.account_line
  acc[account] = acc[account] ?? new Set()
  acc[account].add(entry.source_line)
  return acc
}, {})).flatMap(([account, values]) => values.size > 1 ? [{ account_line: account, source_lines: [...values].sort() }] : [])

const sameAccountSourceDifferentContent = Object.entries(boardTriples.reduce((acc, entry) => {
  const key = `${entry.account_line}__${entry.source_line}`
  acc[key] = acc[key] ?? new Set()
  acc[key].add(entry.content_line)
  return acc
}, {})).flatMap(([key, values]) => {
  if (values.size <= 1) return []
  const [account_line, source_line] = key.split('__')
  return [{ account_line, source_line, content_lines: [...values].sort() }]
})

const summary = {
  generated_at: new Date().toISOString(),
  source_board_file: path.relative(root, latestBoardFile),
  tasks_total: board.length,
  leads_total: leads.length,
  audit_entries: Array.isArray(auditPayload.entries) ? auditPayload.entries.length : 0,
  decision_entries: decisionEntries.length,
  drift_samples: driftTrend.samples?.length ?? 0,
  drift_alerts: driftTrend.alerts?.length ?? 0,
  first_drift_source: driftTrend.firstDriftSource ?? null,
  same_account_different_source: sameAccountDifferentSource,
  same_account_source_different_content: sameAccountSourceDifferentContent,
  system_modes: {
    internal: systemModeInternalPayload.system_mode,
    opensource: systemModeOpenSourcePayload.system_mode,
  },
}

fs.writeFileSync(path.join(outDir, 'dev77-tasks-board-api.json'), JSON.stringify(tasksPayload, null, 2))
fs.writeFileSync(path.join(outDir, 'dev77-leads-api.json'), JSON.stringify({ leads }, null, 2))
fs.writeFileSync(path.join(outDir, 'dev77-audit-log-api.json'), JSON.stringify(auditPayload, null, 2))
fs.writeFileSync(path.join(outDir, 'dev77-decision-log.json'), JSON.stringify({ entries: decisionEntries }, null, 2))
fs.writeFileSync(path.join(outDir, 'dev77-api-summary.json'), JSON.stringify(summary, null, 2))
console.log(`Prepared DEV-77 evidence in ${path.relative(root, outDir)}`)
