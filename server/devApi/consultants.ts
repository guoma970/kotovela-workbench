import type { IncomingMessage, ServerResponse } from 'node:http'

type TaskBoardItem = Record<string, unknown>

type ConsultantsDeps = {
  taskBoardFile: string
  readTaskBoard: (filePath: string) => Promise<unknown>
  summarizeTaskBoard: (payload: unknown) => { board: TaskBoardItem[] }
  buildConsultantRecords: (board: TaskBoardItem[]) => unknown
}

const getDeps = (deps: Record<string, unknown>): ConsultantsDeps => ({
  taskBoardFile: deps.taskBoardFile as ConsultantsDeps['taskBoardFile'],
  readTaskBoard: deps.readTaskBoard as ConsultantsDeps['readTaskBoard'],
  summarizeTaskBoard: deps.summarizeTaskBoard as ConsultantsDeps['summarizeTaskBoard'],
  buildConsultantRecords: deps.buildConsultantRecords as ConsultantsDeps['buildConsultantRecords'],
})

export function createConsultantsHandler(rawDeps: Record<string, unknown>) {
  const { taskBoardFile, readTaskBoard, summarizeTaskBoard, buildConsultantRecords } = getDeps(rawDeps)

  return async function consultantsHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method !== 'GET') {
      next()
      return
    }
    try {
      const payload = summarizeTaskBoard(await readTaskBoard(taskBoardFile))
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ consultants: buildConsultantRecords(payload.board) }))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'consultants fetch failed', message: error instanceof Error ? error.message : String(error) }))
    }
  }
}
