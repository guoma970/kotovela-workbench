import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const outDir = path.join(root, '.evidence', 'dev71')
fs.mkdirSync(outDir, { recursive: true })

const latestBoardFile = fs
  .readdirSync(path.join(root, '.tmp'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('stab-'))
  .map((entry) => path.join(root, '.tmp', entry.name, 'tasks-board.json'))
  .filter((file) => fs.existsSync(file))
  .sort()
  .at(-1)

if (!latestBoardFile) {
  throw new Error('No .tmp/stab-*/tasks-board.json found in repo')
}

const tasksPayload = JSON.parse(fs.readFileSync(latestBoardFile, 'utf8'))
const auditPayload = JSON.parse(fs.readFileSync(path.join(root, 'server/data/audit-log.json'), 'utf8'))
const systemModePayload = JSON.parse(fs.readFileSync(path.join(root, 'server/data/system-mode.internal.json'), 'utf8'))

const board = Array.isArray(tasksPayload.board) ? tasksPayload.board : []
const leads = board
  .filter((entry) => entry.domain === 'business' || entry.lead_id || entry.consultant_id || String(entry.task_name || '').includes('客户'))
  .slice(0, 24)
  .map((entry, index) => ({
    lead_id: entry.lead_id ?? `derived-lead-${index + 1}`,
    title: entry.task_name ?? `lead-${index + 1}`,
    status: entry.status ?? 'unknown',
    source_line: entry.source_line ?? entry.project_line ?? '',
    account_line: entry.account_line ?? '',
    content_line: entry.content_line ?? '',
    consultant_id: entry.consultant_id ?? '',
    decision_log: (entry.decision_log ?? []).slice(-3),
  }))

const decisionEntries = board
  .flatMap((entry) =>
    (entry.decision_log ?? []).slice(-2).map((log) => ({
      task_name: entry.task_name ?? '-',
      action: log.action ?? '-',
      reason: log.reason ?? '-',
      detail: log.detail ?? '-',
      timestamp: log.timestamp ?? '-',
      project_line: entry.project_line ?? '',
      account_line: entry.account_line ?? '',
      source_line: entry.source_line ?? '',
      consultant_id: entry.consultant_id ?? '',
    })),
  )
  .slice(0, 60)

const unresolvedHints = decisionEntries.filter((entry) => !entry.project_line && !entry.account_line && !entry.source_line).length
const summary = {
  generated_at: new Date().toISOString(),
  source_board_file: path.relative(root, latestBoardFile),
  tasks_total: board.length,
  leads_total: leads.length,
  audit_entries: Array.isArray(auditPayload.entries) ? auditPayload.entries.length : 0,
  decision_entries: decisionEntries.length,
  system_mode: systemModePayload.system_mode,
  publish_mode: systemModePayload.publish_mode,
  unresolved_hint_rows: unresolvedHints,
}

fs.writeFileSync(path.join(outDir, 'dev71-tasks-board-api.json'), JSON.stringify(tasksPayload, null, 2))
fs.writeFileSync(path.join(outDir, 'dev71-leads-api.json'), JSON.stringify({ leads }, null, 2))
fs.writeFileSync(path.join(outDir, 'dev71-audit-log-api.json'), JSON.stringify(auditPayload, null, 2))
fs.writeFileSync(path.join(outDir, 'dev71-decision-log.json'), JSON.stringify({ entries: decisionEntries }, null, 2))
fs.writeFileSync(path.join(outDir, 'dev71-api-summary.json'), JSON.stringify(summary, null, 2))

console.log(`Prepared DEV-71 evidence in ${path.relative(root, outDir)}`)
console.log(`board source: ${path.relative(root, latestBoardFile)}`)
