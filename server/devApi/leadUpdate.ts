import type { IncomingMessage, ServerResponse } from 'node:http'

type TaskBoardItem = Record<string, unknown> & {
  lead_id?: string
  consultant_id?: string
  consultant_owner?: string
  assignment_mode?: string
  reassigned_to?: string
  reassigned_at?: string
  reassigned_reason?: string
  status?: string
  converted?: boolean
  lost?: boolean
  updated_at?: string
}

type MutateResult = {
  payload: {
    board: TaskBoardItem[]
  }
}

type ConsultantEntry = {
  consultant_id: string
  consultant_owner?: string
}

type LeadUpdateDeps = {
  taskBoardFile: string
  consultantDirectory: ConsultantEntry[]
  mutateTaskBoard: (
    filePath: string,
    mutator: (payload: { board: TaskBoardItem[] }) => Promise<void> | void,
  ) => Promise<MutateResult>
  appendAuditLog: (entry: { action: string; user: string; time: string; target: string; result: string }) => Promise<unknown>
  syncLeadAssignmentStatus: (item: TaskBoardItem) => void
}

const getDeps = (deps: Record<string, unknown>): LeadUpdateDeps => ({
  taskBoardFile: deps.taskBoardFile as LeadUpdateDeps['taskBoardFile'],
  consultantDirectory: deps.consultantDirectory as LeadUpdateDeps['consultantDirectory'],
  mutateTaskBoard: deps.mutateTaskBoard as LeadUpdateDeps['mutateTaskBoard'],
  appendAuditLog: deps.appendAuditLog as LeadUpdateDeps['appendAuditLog'],
  syncLeadAssignmentStatus: deps.syncLeadAssignmentStatus as LeadUpdateDeps['syncLeadAssignmentStatus'],
})

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>
}

export function createLeadUpdateHandler(rawDeps: Record<string, unknown>) {
  const { taskBoardFile, consultantDirectory, mutateTaskBoard, appendAuditLog, syncLeadAssignmentStatus } = getDeps(rawDeps)

  return async function leadUpdateHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method !== 'POST') {
      next()
      return
    }
    try {
      const body = await readBody(req)
      const leadId = String(body.lead_id || '').trim()
      if (!leadId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'missing lead_id' }))
        return
      }
      const { payload } = await mutateTaskBoard(taskBoardFile, async (current) => {
        const target = current.board.find((item) => item.lead_id === leadId)
        if (!target) throw new Error('lead not found')
        const now = new Date().toISOString()
        const nextConsultant = String(body.consultant_id || '').trim()
        const nextStatus = String(body.status || '').trim()
        const reason = String(body.reassigned_reason || '').trim()
        if (nextConsultant && nextConsultant !== target.consultant_id) {
          target.reassigned_to = nextConsultant
          target.reassigned_at = now
          target.reassigned_reason = reason || 'manual_reassign'
          target.consultant_id = nextConsultant
          target.consultant_owner = consultantDirectory.find((entry) => entry.consultant_id === nextConsultant)?.consultant_owner || nextConsultant
          target.assignment_mode = 'manual'
          await appendAuditLog({ action: 'consultant_reassigned', user: 'builder', time: now, target: leadId, result: `assigned to ${nextConsultant}` })
        }
        if (nextStatus) {
          target.status = nextStatus
          target.converted = nextStatus === 'done' || nextStatus === 'success' || nextStatus === 'converted'
          target.lost = nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'lost'
        }
        syncLeadAssignmentStatus(target)
        target.updated_at = now
      })
      const lead = payload.board.find((item) => item.lead_id === leadId)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, lead }))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'lead update failed', message: error instanceof Error ? error.message : String(error) }))
    }
  }
}
