import type { IncomingMessage, ServerResponse } from 'node:http'

type TaskBoardResult = Record<string, unknown> & {
  meta?: Record<string, unknown>
}

type TaskBoardItem = Record<string, unknown> & {
  task_name: string
  agent?: string
  domain?: string
  subdomain?: string
  project_line?: string
  target_group_id?: string
  notify_mode?: string
  preferred_agent?: string
  assigned_agent?: string
  target_system?: string
  slot_id?: string | null
  priority?: number
  retry_count?: number
  type?: string
  status?: string
  timestamp?: string
  queued_at?: string
  updated_at?: string
  attention?: boolean
  stuck?: boolean
  abnormal?: boolean
  auto_decision_log?: unknown[]
  decision_log?: unknown[]
  human_owner?: string
  taken_over_at?: string
  manual_decision?: string
  control_status?: string
  result?: TaskBoardResult
  history?: unknown[]
}

type TaskBoardPayload = Record<string, unknown> & {
  board: TaskBoardItem[]
}

type TaskBoardSource = {
  source_type?: string
  source_project?: string
  chapter_title?: string
  core_points?: string
  title?: string
  source_line?: string
}

type TaskRoute = {
  assigned_agent: string
  domain: string
  subdomain: string
  project_line: string
  target_group_id: string
  notify_mode: string
  preferred_agent: string
  target_system: string
  type: string
}

type MutateResult = {
  payload: TaskBoardPayload
}

type TasksBoardDeps = {
  taskBoardFile: string
  scenarioTemplates: Record<string, unknown>
  readTaskBoard: (filePath: string) => Promise<TaskBoardPayload>
  summarizeTaskBoard: (payload: TaskBoardPayload) => unknown
  readMemoryStore: () => Promise<unknown[]>
  createScenarioTemplateTasks: (templateKey: string, now: string) => TaskBoardItem[]
  applyUserContextOnCreate: (item: TaskBoardItem, memoryRecords: unknown[]) => void
  mutateTaskBoard: (
    filePath: string,
    mutator: (payload: TaskBoardPayload) => Promise<void> | void,
  ) => Promise<MutateResult>
  ensureBusinessFields: (item: TaskBoardItem, now: string, board?: TaskBoardItem[]) => Promise<void>
  createContentRoutingTasks: (
    input: string,
    now: string,
    source?: TaskBoardSource,
  ) => TaskBoardItem[] | undefined
  createBookManuscriptTasks: (source: TaskBoardSource, now: string) => TaskBoardItem[]
  inferTaskRoute: (taskName: string) => TaskRoute
  appendHistory: (item: TaskBoardItem, entry: Record<string, unknown>) => void
  buildTextResult: (taskName: string) => TaskBoardResult
  applyManualTaskAction: (item: TaskBoardItem, action: string, humanOwner: string, now: string) => Promise<void> | void
  clampPriority: (priority: unknown) => number
  priorityLabel: (priority: number) => string
  appendDecisionLog: (item: TaskBoardItem, action: string, reason: string, detail: string, now: string) => void
}

const getDeps = (deps: Record<string, unknown>): TasksBoardDeps => ({
  taskBoardFile: deps.taskBoardFile as TasksBoardDeps['taskBoardFile'],
  scenarioTemplates: deps.scenarioTemplates as TasksBoardDeps['scenarioTemplates'],
  readTaskBoard: deps.readTaskBoard as TasksBoardDeps['readTaskBoard'],
  summarizeTaskBoard: deps.summarizeTaskBoard as TasksBoardDeps['summarizeTaskBoard'],
  readMemoryStore: deps.readMemoryStore as TasksBoardDeps['readMemoryStore'],
  createScenarioTemplateTasks: deps.createScenarioTemplateTasks as TasksBoardDeps['createScenarioTemplateTasks'],
  applyUserContextOnCreate: deps.applyUserContextOnCreate as TasksBoardDeps['applyUserContextOnCreate'],
  mutateTaskBoard: deps.mutateTaskBoard as TasksBoardDeps['mutateTaskBoard'],
  ensureBusinessFields: deps.ensureBusinessFields as TasksBoardDeps['ensureBusinessFields'],
  createContentRoutingTasks: deps.createContentRoutingTasks as TasksBoardDeps['createContentRoutingTasks'],
  createBookManuscriptTasks: deps.createBookManuscriptTasks as TasksBoardDeps['createBookManuscriptTasks'],
  inferTaskRoute: deps.inferTaskRoute as TasksBoardDeps['inferTaskRoute'],
  appendHistory: deps.appendHistory as TasksBoardDeps['appendHistory'],
  buildTextResult: deps.buildTextResult as TasksBoardDeps['buildTextResult'],
  applyManualTaskAction: deps.applyManualTaskAction as TasksBoardDeps['applyManualTaskAction'],
  clampPriority: deps.clampPriority as TasksBoardDeps['clampPriority'],
  priorityLabel: deps.priorityLabel as TasksBoardDeps['priorityLabel'],
  appendDecisionLog: deps.appendDecisionLog as TasksBoardDeps['appendDecisionLog'],
})

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const bodyText = Buffer.concat(chunks).toString('utf8')
  return bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {}
}

export function createTasksBoardHandler(rawDeps: Record<string, unknown>) {
  const {
    taskBoardFile,
    scenarioTemplates,
    readTaskBoard,
    summarizeTaskBoard,
    readMemoryStore,
    createScenarioTemplateTasks,
    applyUserContextOnCreate,
    mutateTaskBoard,
    ensureBusinessFields,
    createContentRoutingTasks,
    createBookManuscriptTasks,
    inferTaskRoute,
    appendHistory,
    buildTextResult,
    applyManualTaskAction,
    clampPriority,
    priorityLabel,
    appendDecisionLog,
  } = getDeps(rawDeps)

  return async function tasksBoardHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method === 'GET') {
      try {
        const payload = await readTaskBoard(taskBoardFile)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(summarizeTaskBoard(payload)))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: 'tasks-board fetch failed',
            message: error instanceof Error ? error.message : String(error),
          }),
        )
      }
      return
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      try {
        const body = await readBody(req)

        if (req.method === 'POST') {
          const taskInput = String(body.input || '').trim()
          const templateKey = String(body.template_key || '').trim()
          const sourcePayload = body.source as Partial<TaskBoardSource> | undefined

          if (templateKey && templateKey in scenarioTemplates) {
            const memoryRecords = await readMemoryStore()
            const now = new Date().toISOString()
            const scenarioTasks = createScenarioTemplateTasks(templateKey, now).map((item) => {
              applyUserContextOnCreate(item, memoryRecords)
              return item
            })
            const { payload: executed } = await mutateTaskBoard(taskBoardFile, async (payload) => {
              payload.board.unshift(...scenarioTasks.reverse())
              for (const item of scenarioTasks) {
                await ensureBusinessFields(item, now, payload.board)
              }
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(summarizeTaskBoard(executed)))
            return
          }

          const hasStructuredSource = ['book_manuscript', 'product_brochure', 'case_booklet'].includes(String(sourcePayload?.source_type || ''))
            && String(sourcePayload?.core_points || '').trim()

          if (hasStructuredSource) {
            const memoryRecords = await readMemoryStore()
            const now = new Date().toISOString()
            const sourceType = String(sourcePayload?.source_type || '').trim()
            const source: TaskBoardSource = {
              source_type: sourceType,
              source_project: String(sourcePayload?.source_project || '').trim()
                || (sourceType === 'book_manuscript' ? 'japanese_renovation_guide' : sourceType === 'product_brochure' ? 'product_material_system' : 'case_library'),
              chapter_title: String(sourcePayload?.chapter_title || '').trim(),
              core_points: String(sourcePayload?.core_points || '').trim(),
              title: String(sourcePayload?.title || '').trim(),
              source_line: String(sourcePayload?.source_line || '').trim() || undefined,
            }
            const contentRoutingTasks = createContentRoutingTasks(source.title || source.chapter_title || source.core_points || '', now, source)
            const roleTasks = (contentRoutingTasks ?? (source.source_type === 'book_manuscript' ? createBookManuscriptTasks(source, now) : [])).map((item) => {
              applyUserContextOnCreate(item, memoryRecords)
              return item
            })
            const { payload: executed } = await mutateTaskBoard(taskBoardFile, async (payload) => {
              payload.board.unshift(...roleTasks.reverse())
              for (const item of roleTasks) {
                await ensureBusinessFields(item, now, payload.board)
              }
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(summarizeTaskBoard(executed)))
            return
          }

          if (!taskInput) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'missing input' }))
            return
          }

          const contentRoutingTasks = createContentRoutingTasks(taskInput, new Date().toISOString())
          if (contentRoutingTasks?.length) {
            const memoryRecords = await readMemoryStore()
            const now = new Date().toISOString()
            const tasks = createContentRoutingTasks(taskInput, now)?.map((item) => {
              applyUserContextOnCreate(item, memoryRecords)
              return item
            }) ?? []
            const { payload: executed } = await mutateTaskBoard(taskBoardFile, async (payload) => {
              payload.board.unshift(...tasks.reverse())
              for (const item of tasks) {
                await ensureBusinessFields(item, now)
              }
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(summarizeTaskBoard(executed)))
            return
          }

          if (taskInput.startsWith('queue:')) {
            const memoryRecords = await readMemoryStore()
            const now = new Date().toISOString()
            const taskName = taskInput.slice(6).trim() || `queued-${Date.now()}`
            const route = inferTaskRoute(taskName)
            const nextItem: TaskBoardItem = {
              task_name: taskName,
              agent: route.assigned_agent,
              domain: route.domain,
              subdomain: route.subdomain,
              project_line: route.project_line,
              target_group_id: route.target_group_id,
              notify_mode: route.notify_mode,
              preferred_agent: route.preferred_agent,
              assigned_agent: route.assigned_agent,
              target_system: route.target_system,
              slot_id: null,
              priority: 3,
              retry_count: 0,
              type: route.type,
              status: 'queued',
              timestamp: now,
              queued_at: now,
              updated_at: now,
              attention: false,
              stuck: false,
              abnormal: false,
              auto_decision_log: [],
              decision_log: [],
              human_owner: undefined,
              taken_over_at: undefined,
              manual_decision: undefined,
              history: [{ action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'queued', priority_after: 3 }],
            }
            applyUserContextOnCreate(nextItem, memoryRecords)
            const { payload: executed } = await mutateTaskBoard(taskBoardFile, async (payload) => {
              payload.board.unshift(nextItem)
              await ensureBusinessFields(nextItem, now, payload.board)
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(summarizeTaskBoard(executed)))
            return
          }

          if (taskInput.startsWith('fail:')) {
            const now = new Date().toISOString()
            await mutateTaskBoard(taskBoardFile, async (payload) => {
              const existing = payload.board.find((item) => item.task_name === taskInput)
              if (existing) {
                appendHistory(existing, {
                  action: 'fail',
                  operator: 'system',
                  trigger_source: 'system',
                  timestamp: now,
                  status_before: existing.status,
                  status_after: 'failed',
                  priority_before: existing.priority,
                  priority_after: existing.priority,
                  error: taskInput.slice(5).trim() || '模拟失败',
                })
                existing.status = 'failed'
                existing.attention = true
                existing.updated_at = now
              } else {
                payload.board.unshift({
                  task_name: taskInput,
                  agent: 'builder',
                  domain: 'builder',
                  subdomain: 'engineering',
                  project_line: 'builder_default',
                  target_group_id: 'builder_default',
                  notify_mode: 'default',
                  preferred_agent: 'builder',
                  assigned_agent: 'builder',
                  target_system: 'openclaw-builder',
                  slot_id: null,
                  priority: 3,
                  retry_count: 0,
                  type: 'dev',
                  status: 'failed',
                  timestamp: now,
                  updated_at: now,
                  queued_at: now,
                  attention: true,
                  stuck: false,
                  abnormal: false,
                  auto_decision_log: [],
                  decision_log: [],
                  human_owner: undefined,
                  taken_over_at: undefined,
                  manual_decision: undefined,
                  history: [
                    { action: 'create', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'failed', priority_after: 3 },
                    { action: 'fail', operator: 'system', trigger_source: 'system', timestamp: now, status_after: 'failed', priority_after: 3, error: taskInput.slice(5).trim() || '模拟失败' },
                  ],
                })
              }
            })
            throw new Error(taskInput.slice(5).trim() || '模拟失败')
          }

          const memoryRecords = await readMemoryStore()
          const now = new Date().toISOString()
          const route = inferTaskRoute(taskInput)
          const nextItem: TaskBoardItem = {
            task_name: taskInput,
            agent: route.assigned_agent,
            domain: route.domain,
            subdomain: route.subdomain,
            project_line: route.project_line,
            target_group_id: route.target_group_id,
            notify_mode: route.notify_mode,
            preferred_agent: route.preferred_agent,
            assigned_agent: route.assigned_agent,
            target_system: route.target_system,
            slot_id: null,
            priority: 3,
            retry_count: 0,
            type: route.type,
            status: 'queued',
            timestamp: now,
            queued_at: now,
            updated_at: now,
            attention: false,
            stuck: false,
            abnormal: false,
            auto_decision_log: [],
            decision_log: [],
            human_owner: undefined,
            taken_over_at: undefined,
            manual_decision: undefined,
            history: [
              {
                action: 'create',
                operator: 'system',
                trigger_source: 'system',
                timestamp: now,
                status_after: 'queued',
                priority_after: 3,
              },
            ],
          }
          applyUserContextOnCreate(nextItem, memoryRecords)
          const { payload: executed } = await mutateTaskBoard(taskBoardFile, async (payload) => {
            payload.board.unshift(nextItem)
            await ensureBusinessFields(nextItem, now, payload.board)
          })
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(summarizeTaskBoard(executed)))
          return
        }

        const taskName = String(body.task_name || '').trim()
        const action = String(body.action || '').trim()
        const humanOwner = String(body.human_owner || body.assignee || '').trim()
        if (!taskName || !action) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'missing task_name/action' }))
          return
        }

        const { payload: executed } = await mutateTaskBoard(taskBoardFile, async (payload) => {
          const target = payload.board.find((item) => item.task_name === taskName)
          if (!target) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'task not found' }))
            return
          }

          const now = new Date().toISOString()
          if (action === 'pause') {
            appendHistory(target, {
              action: 'pause',
              operator: 'builder',
              trigger_source: 'manual',
              timestamp: now,
              before: { status: target.status, priority: target.priority },
              after: { status: 'paused', priority: target.priority },
            })
            target.control_status = 'paused'
            target.status = 'paused'
          } else if (action === 'resume') {
            appendHistory(target, {
              action: 'resume',
              operator: 'builder',
              trigger_source: 'manual',
              timestamp: now,
              before: { status: target.status, priority: target.priority },
              after: { status: 'todo', priority: target.priority },
            })
            target.control_status = 'active'
            target.status = 'todo'
          } else if (action === 'cancel') {
            appendHistory(target, {
              action: 'cancel',
              operator: 'builder',
              trigger_source: 'manual',
              timestamp: now,
              before: { status: target.status, priority: target.priority },
              after: { status: 'cancelled', priority: target.priority },
            })
            target.control_status = 'cancelled'
            target.status = 'cancelled'
          } else if (action === 'priority_up') {
            const nextPriority = Math.max(0, clampPriority(target.priority) - 1)
            appendHistory(target, {
              action: 'priority_change',
              operator: 'builder',
              trigger_source: 'manual',
              timestamp: now,
              before: { status: target.status, priority: target.priority },
              after: { status: target.status, priority: nextPriority },
            })
            appendDecisionLog(target, 'priority_up', 'manual_priority_change', `${priorityLabel(clampPriority(target.priority))} -> ${priorityLabel(nextPriority)}`, now)
            target.priority = nextPriority
          } else if (action === 'priority_down') {
            const nextPriority = Math.min(3, clampPriority(target.priority) + 1)
            appendHistory(target, {
              action: 'priority_change',
              operator: 'builder',
              trigger_source: 'manual',
              timestamp: now,
              before: { status: target.status, priority: target.priority },
              after: { status: target.status, priority: nextPriority },
            })
            appendDecisionLog(target, 'priority_down', 'manual_priority_change', `${priorityLabel(clampPriority(target.priority))} -> ${priorityLabel(nextPriority)}`, now)
            target.priority = nextPriority
          } else if (action === 'mark_template_source') {
            target.result = target.result ?? buildTextResult(target.task_name)
            target.result.meta = { ...(target.result.meta ?? {}), template_source: true }
            appendDecisionLog(target, 'manual_done', 'template_source_marked', '已标记为模板来源', now)
          } else if (['takeover', 'assign', 'ignore', 'manual_done', 'manual_continue', 'mark_manual_published'].includes(action)) {
            await applyManualTaskAction(target, action, humanOwner, now)
          } else {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'unsupported action' }))
            return
          }
          target.updated_at = now
          await ensureBusinessFields(target, now, payload.board)
        })
        if (res.writableEnded) return
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(executed))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: 'tasks-board execute failed',
            message: error instanceof Error ? error.message : String(error),
          }),
        )
      }
      return
    }

    next()
  }
}
