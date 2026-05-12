import type { IncomingMessage, ServerResponse } from 'node:http'

type MemoryRecord = {
  user_id: string
  memory_type: 'preference' | 'habit' | 'history' | 'constraint'
  key: string
  value: unknown
  updated_at: string
}

type MemoryDeps = {
  readMemoryStore: () => Promise<MemoryRecord[]>
  writeMemoryStore: (records: MemoryRecord[]) => Promise<void>
  upsertMemoryRecord: (records: MemoryRecord[], nextRecord: MemoryRecord) => void
}

const getDeps = (deps: Record<string, unknown>): MemoryDeps => ({
  readMemoryStore: deps.readMemoryStore as MemoryDeps['readMemoryStore'],
  writeMemoryStore: deps.writeMemoryStore as MemoryDeps['writeMemoryStore'],
  upsertMemoryRecord: deps.upsertMemoryRecord as MemoryDeps['upsertMemoryRecord'],
})

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Partial<MemoryRecord>
}

export function createMemoryHandler(rawDeps: Record<string, unknown>) {
  const { readMemoryStore, writeMemoryStore, upsertMemoryRecord } = getDeps(rawDeps)

  return async function memoryHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method === 'GET') {
      try {
        const userId = String(new URL(req.url ?? '', 'http://localhost').searchParams.get('user_id') ?? '').trim()
        const records = await readMemoryStore()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ user_id: userId, records: userId ? records.filter((record) => record.user_id === userId) : records }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'memory fetch failed', message: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req)
        if (!body.user_id || !body.memory_type || !body.key) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'missing memory fields' }))
          return
        }
        const records = await readMemoryStore()
        const nextRecord: MemoryRecord = { user_id: body.user_id, memory_type: body.memory_type, key: body.key, value: body.value, updated_at: new Date().toISOString() }
        upsertMemoryRecord(records, nextRecord)
        await writeMemoryStore(records)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, record: nextRecord }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'memory write failed', message: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    next()
  }
}
