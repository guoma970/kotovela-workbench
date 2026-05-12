import type { IncomingMessage, ServerResponse } from 'node:http'

type ContentLearningRecord = Record<string, unknown> & {
  learning_score: number
}

type LearningFeedbackInput = {
  content_line: string
  account_line: string
  structure_id: string
  structure_type: string
  score: number
  sentiment?: 'positive' | 'negative' | 'neutral'
  timestamp: string
}

type ContentFeedbackDeps = {
  readContentLearningStore: () => Promise<ContentLearningRecord[]>
  writeContentLearningStore: (records: ContentLearningRecord[]) => Promise<void>
  upsertLearningFeedback: (records: ContentLearningRecord[], input: LearningFeedbackInput) => ContentLearningRecord
}

const getDeps = (deps: Record<string, unknown>): ContentFeedbackDeps => ({
  readContentLearningStore: deps.readContentLearningStore as ContentFeedbackDeps['readContentLearningStore'],
  writeContentLearningStore: deps.writeContentLearningStore as ContentFeedbackDeps['writeContentLearningStore'],
  upsertLearningFeedback: deps.upsertLearningFeedback as ContentFeedbackDeps['upsertLearningFeedback'],
})

const readBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const bodyText = Buffer.concat(chunks).toString('utf8')
  return bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {}
}

const toSentiment = (value: unknown): LearningFeedbackInput['sentiment'] => {
  if (value === 'positive' || value === 'negative' || value === 'neutral') return value
  return undefined
}

export function createContentFeedbackHandler(rawDeps: Record<string, unknown>) {
  const { readContentLearningStore, writeContentLearningStore, upsertLearningFeedback } = getDeps(rawDeps)

  return async function contentFeedbackHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method === 'GET') {
      try {
        const records = await readContentLearningStore()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ records: records.sort((a, b) => b.learning_score - a.learning_score) }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'content-feedback fetch failed', message: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req)
        const contentLine = String(body.content_line || '').trim()
        const accountLine = String(body.account_line || '').trim()
        const structureId = String(body.structure_id || '').trim()
        const structureType = String(body.structure_type || 'short_content').trim()
        const score = Number(body.score ?? 0)
        if (!contentLine || !accountLine || !structureId || !Number.isFinite(score) || score <= 0) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'missing learning feedback fields' }))
          return
        }
        const records = await readContentLearningStore()
        const record = upsertLearningFeedback(records, {
          content_line: contentLine,
          account_line: accountLine,
          structure_id: structureId,
          structure_type: structureType,
          score,
          sentiment: toSentiment(body.sentiment),
          timestamp: new Date().toISOString(),
        })
        await writeContentLearningStore(records)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, record }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'content-feedback write failed', message: error instanceof Error ? error.message : String(error) }))
      }
      return
    }

    next()
  }
}
