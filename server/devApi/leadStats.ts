import type { IncomingMessage, ServerResponse } from 'node:http'

type TaskBoardItem = Record<string, unknown>

type LeadStatsDeps = {
  taskBoardFile: string
  readTaskBoard: (filePath: string) => Promise<unknown>
  summarizeTaskBoard: (payload: unknown) => { board: TaskBoardItem[]; business_summary?: unknown }
  summarizeBusinessBoard: (board: TaskBoardItem[]) => unknown
}

const getDeps = (deps: Record<string, unknown>): LeadStatsDeps => ({
  taskBoardFile: deps.taskBoardFile as LeadStatsDeps['taskBoardFile'],
  readTaskBoard: deps.readTaskBoard as LeadStatsDeps['readTaskBoard'],
  summarizeTaskBoard: deps.summarizeTaskBoard as LeadStatsDeps['summarizeTaskBoard'],
  summarizeBusinessBoard: deps.summarizeBusinessBoard as LeadStatsDeps['summarizeBusinessBoard'],
})

export function createLeadStatsHandler(rawDeps: Record<string, unknown>) {
  const { taskBoardFile, readTaskBoard, summarizeTaskBoard, summarizeBusinessBoard } = getDeps(rawDeps)

  return async function leadStatsHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method !== 'GET') {
      next()
      return
    }
    try {
      const payload = summarizeTaskBoard(await readTaskBoard(taskBoardFile))
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(payload.business_summary ?? summarizeBusinessBoard(payload.board)))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'lead-stats fetch failed', message: error instanceof Error ? error.message : String(error) }))
    }
  }
}
