import type { IncomingMessage, ServerResponse } from 'node:http'

type TaskBoardItem = Record<string, unknown> & {
  task_name: string
  lead_id?: string
  result?: Record<string, unknown>
  history?: unknown[]
}

type TaskBoardPayload = {
  board: TaskBoardItem[]
}

type MutateResult = {
  payload: TaskBoardPayload
}

type LeadsDeps = {
  taskBoardFile: string
  readTaskBoard: (filePath: string) => Promise<TaskBoardPayload>
  summarizeTaskBoard: (payload: TaskBoardPayload) => TaskBoardPayload
  buildTextResult: (title: string) => Record<string, unknown>
  mutateTaskBoard: (
    filePath: string,
    mutator: (payload: TaskBoardPayload) => Promise<void> | void,
  ) => Promise<MutateResult>
  ensureBusinessFields: (item: TaskBoardItem, now: string, board?: TaskBoardItem[]) => Promise<void>
}

const getDeps = (deps: Record<string, unknown>): LeadsDeps => ({
  taskBoardFile: deps.taskBoardFile as LeadsDeps['taskBoardFile'],
  readTaskBoard: deps.readTaskBoard as LeadsDeps['readTaskBoard'],
  summarizeTaskBoard: deps.summarizeTaskBoard as LeadsDeps['summarizeTaskBoard'],
  buildTextResult: deps.buildTextResult as LeadsDeps['buildTextResult'],
  mutateTaskBoard: deps.mutateTaskBoard as LeadsDeps['mutateTaskBoard'],
  ensureBusinessFields: deps.ensureBusinessFields as LeadsDeps['ensureBusinessFields'],
})

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Partial<TaskBoardItem>
}

export function createLeadsHandler(rawDeps: Record<string, unknown>) {
  const { taskBoardFile, readTaskBoard, summarizeTaskBoard, buildTextResult, mutateTaskBoard, ensureBusinessFields } = getDeps(rawDeps)

  return async function leadsHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method === 'GET') {
      try {
        const payload = summarizeTaskBoard(await readTaskBoard(taskBoardFile))
        const leads = payload.board
          .filter((item) => item.lead_id)
          .map((item) => ({
            lead_id: item.lead_id,
            task_name: item.task_name,
            source_line: item.source_line,
            account_line: item.account_line,
            content_line: item.content_line,
            consultant_id: item.consultant_id,
            consultant_owner: item.consultant_owner,
            assignment_mode: item.assignment_mode,
            assignment_status: item.assignment_status,
            reassigned_to: item.reassigned_to,
            reassigned_at: item.reassigned_at,
            reassigned_reason: item.reassigned_reason,
            converted: item.converted ?? false,
            lost: item.lost ?? false,
            attribution: item.attribution ?? null,
            status: item.status,
            domain: item.domain,
            updated_at: item.updated_at,
            decision_log: item.decision_log ?? [],
            projectId: item.projectId,
            agentId: item.agentId,
            roomId: item.roomId,
            taskId: item.taskId,
            routingHints: item.routingHints,
          }))
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ leads }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'leads fetch failed', message: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req)
        const title = String(body.task_name || '').trim()
        if (!title) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'missing lead title' }))
          return
        }
        const now = new Date().toISOString()
        const nextItem: TaskBoardItem = {
          task_name: title,
          agent: 'business',
          domain: 'business',
          subdomain: 'consulting',
          project_line: 'kotovela_official',
          priority: 1,
          type: 'business_task',
          status: 'queued',
          timestamp: now,
          queued_at: now,
          updated_at: now,
          result: buildTextResult(title),
          assignment_mode: 'auto',
          history: [{ action: 'create', operator: 'system', trigger_source: 'manual', timestamp: now, status_after: 'queued', priority_after: 1 }],
        }
        await mutateTaskBoard(taskBoardFile, async (current) => {
          current.board.unshift(nextItem)
          await ensureBusinessFields(nextItem, now, current.board)
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, lead: nextItem }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'lead create failed', message: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    next()
  }
}
