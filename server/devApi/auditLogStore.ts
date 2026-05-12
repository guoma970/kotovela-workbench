import fs from 'node:fs/promises'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(process.env.PROJECT_ROOT ?? process.env.OPENCLAW_PROJECT_ROOT ?? process.cwd())
const AUDIT_LOG_FILE = path.resolve(process.env.AUDIT_LOG_FILE ?? path.join(PROJECT_ROOT, 'server', 'data', 'audit-log.json'))

export type AuditLogEntry = {
  id: string
  action: string
  user: string
  time: string
  target: string
  result: string
}

export async function readAuditLog() {
  try {
    const raw = await fs.readFile(AUDIT_LOG_FILE, 'utf8')
    const payload = JSON.parse(raw) as { entries?: AuditLogEntry[] }
    return Array.isArray(payload.entries) ? payload.entries : []
  } catch {
    await fs.mkdir(path.dirname(AUDIT_LOG_FILE), { recursive: true })
    await fs.writeFile(AUDIT_LOG_FILE, `${JSON.stringify({ entries: [] }, null, 2)}\n`, 'utf8')
    return []
  }
}

export async function writeAuditLog(entries: AuditLogEntry[]) {
  await fs.mkdir(path.dirname(AUDIT_LOG_FILE), { recursive: true })
  await fs.writeFile(AUDIT_LOG_FILE, `${JSON.stringify({ entries }, null, 2)}\n`, 'utf8')
}

export async function appendAuditLog(entry: Omit<AuditLogEntry, 'id'>) {
  const entries = await readAuditLog()
  const nextEntry: AuditLogEntry = {
    id: `audit-${new Date(entry.time).getTime()}-${entries.length + 1}`,
    ...entry,
  }
  await writeAuditLog([nextEntry, ...entries].slice(0, 100))
  return nextEntry
}
