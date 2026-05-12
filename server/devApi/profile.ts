import type { IncomingMessage, ServerResponse } from 'node:http'

type MemoryRecord = Record<string, unknown>

type ProfileDeps = {
  readMemoryStore: () => Promise<MemoryRecord[]>
  deriveProfile: (userId: string, records: MemoryRecord[]) => unknown
}

const getDeps = (deps: Record<string, unknown>): ProfileDeps => ({
  readMemoryStore: deps.readMemoryStore as ProfileDeps['readMemoryStore'],
  deriveProfile: deps.deriveProfile as ProfileDeps['deriveProfile'],
})

export function createProfileHandler(rawDeps: Record<string, unknown>) {
  const { readMemoryStore, deriveProfile } = getDeps(rawDeps)

  return async function profileHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method !== 'GET') {
      next()
      return
    }
    try {
      const userId = String(new URL(req.url ?? '', 'http://localhost').searchParams.get('user_id') ?? '').trim()
      if (!userId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'missing user_id' }))
        return
      }
      const records = await readMemoryStore()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(deriveProfile(userId, records)))
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'profile fetch failed', message: error instanceof Error ? error.message : String(error) }))
    }
  }
}
