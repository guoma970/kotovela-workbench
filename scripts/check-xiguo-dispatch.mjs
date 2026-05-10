import http from 'node:http'
import { once } from 'node:events'
import { dispatchToXiguo, getXiguoDispatchReadiness, sendFeishuStudyMessage } from '../server/xiugDispatch.ts'

const readBody = async (req) =>
  new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const requests = []
const server = http.createServer(async (req, res) => {
  const bodyText = await readBody(req)
  const body = bodyText ? JSON.parse(bodyText) : null
  requests.push({ url: req.url, method: req.method, headers: req.headers, body })

  if (req.url === '/xiguo-ok') {
    if (req.headers['x-api-key'] !== 'test-xiguo-key') {
      sendJson(res, 401, { ok: false, error: 'missing key' })
      return
    }
    sendJson(res, 200, {
      ok: true,
      deepLink: `https://xiguo.kotovela.com/ai-session?role=child&date=${body?.date}`,
    })
    return
  }

  if (req.url === '/xiguo-fail') {
    sendJson(res, 503, { ok: false, error: 'temporary unavailable' })
    return
  }

  if (req.url === '/feishu') {
    sendJson(res, 200, { code: 0, msg: 'success' })
    return
  }

  sendJson(res, 404, { ok: false, error: 'not found' })
})

server.listen(0, '127.0.0.1')
await once(server, 'listening')

const { port } = server.address()
const baseUrl = `http://127.0.0.1:${port}`
const tasks = [
  { id: 't1', title: '数学练习', subject: 'math', durationMinutes: 25, description: '练习册第45-47页' },
  { id: 't2', title: '语文阅读', subject: 'reading', durationMinutes: 15, description: '阅读理解一篇' },
]

try {
  delete process.env.FEISHU_APP_ID
  delete process.env.FEISHU_APP_SECRET
  delete process.env.FEISHU_STUDY_WEBHOOK
  delete process.env.OPENCLAW_STUDY_MESSAGE_API_URL
  process.env.XIGUO_API_KEY = 'test-xiguo-key'
  process.env.XIGUO_LINK_SECRET = 'test-link-secret'
  process.env.XIGUO_API_URL = `${baseUrl}/xiguo-ok`
  process.env.FEISHU_STUDY_TEST_WEBHOOK = `${baseUrl}/feishu`

  const readiness = getXiguoDispatchReadiness()
  if (!readiness.allConfigured || readiness.missing.length > 0) {
    throw new Error(`readiness check failed: ${JSON.stringify(readiness)}`)
  }

  const xiguoOk = await dispatchToXiguo({ date: '2026-05-07', confirmedBy: 'parent', tasks })
  if (!xiguoOk.ok || !xiguoOk.deepLink.includes('date=2026-05-07')) {
    throw new Error(`xiguo success path failed: ${JSON.stringify(xiguoOk)}`)
  }

  const feishuOk = await sendFeishuStudyMessage(tasks, xiguoOk.deepLink, '2026-05-07', 'collab')
  if (!feishuOk.ok) {
    throw new Error(`feishu success path failed: ${JSON.stringify(feishuOk)}`)
  }

  process.env.XIGUO_API_URL = `${baseUrl}/xiguo-fail`
  const xiguoFail = await dispatchToXiguo({ date: '2026-05-07', confirmedBy: 'parent', tasks })
  if (xiguoFail.ok || !xiguoFail.error.includes('503')) {
    throw new Error(`xiguo failure path failed: ${JSON.stringify(xiguoFail)}`)
  }

  const feishuRequest = requests.find((request) => request.url === '/feishu')
  const feishuText = feishuRequest?.body?.content?.text ?? ''
  if (
    !feishuText.includes('【测试确认】果果学习任务待确认') ||
    !feishuText.includes('现在做：数学练习') ||
    !feishuText.includes('确认后再发到学习布置群') ||
    feishuText.includes('语文阅读') ||
    !feishuText.includes('开始学习：https://xiguo.kotovela.com/')
  ) {
    throw new Error(`feishu message format invalid: ${feishuText}`)
  }

  console.log('[check:xiguo-dispatch] xiguo success: ok')
  console.log('[check:xiguo-dispatch] feishu success: ok')
  console.log('[check:xiguo-dispatch] readiness: ok')
  console.log('[check:xiguo-dispatch] xiguo failure returns error: ok')
  console.log(`[check:xiguo-dispatch] observed requests: ${requests.length}`)
} finally {
  server.close()
}
