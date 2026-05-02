#!/usr/bin/env node
/**
 * 本机自检：在 **已运行** `npm run serve:office-api` 时探测 `/api/office-instances`。
 * 用法：`npm run check:office-api`
 * 可选：
 *   - `OFFICE_CHECK_URL=... npm run check:office-api`
 *   - `OFFICE_CHECK_TOKEN=... npm run check:office-api`
 */

const DEFAULT_URLS = [
  'http://localhost:8787/api/office-instances',
  'http://127.0.0.1:8787/api/office-instances',
  'http://[::1]:8787/api/office-instances',
]

async function main() {
  const fromEnv = process.env.OFFICE_CHECK_URL?.trim()
  const token = process.env.OFFICE_CHECK_TOKEN?.trim()
  const urls = fromEnv ? [fromEnv] : DEFAULT_URLS
  let lastErr = null

  for (const url of urls) {
    try {
      const headers = { Accept: 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      const res = await fetch(url, { headers })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} ${res.statusText}`)
        continue
      }
      const data = await res.json()
      const instances = Array.isArray(data.instances) ? data.instances : []
      const statusCount = instances.reduce((acc, row) => {
        const key = typeof row?.status === 'string' ? row.status : 'unknown'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})
      console.log('[check:office-api] OK')
      console.log('  url:', url)
      console.log('  source:', data.source ?? '(missing)')
      console.log('  generatedAt:', data.generatedAt ?? '(missing)')
      console.log('  snapshotGeneratedAt:', data.snapshotGeneratedAt ?? '(missing)')
      console.log('  instances:', instances.length)
      console.log('  statuses:', JSON.stringify(statusCount))
      for (const row of instances.slice(0, 8)) {
        const note = typeof row.note === 'string' ? row.note : '(no note)'
        console.log(`  - ${row.key}: ${row.status} · ${note}`)
      }
      if (instances.length > 8) {
        console.log(`  … ${instances.length - 8} more`)
      }
      process.exit(0)
    } catch (err) {
      lastErr = err
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  const cause = lastErr instanceof Error && lastErr.cause ? String(lastErr.cause) : ''
  console.error('[check:office-api] 全部 URL 均失败（请确认另一终端里 `npm run serve:office-api` 仍在运行，且未报端口占用）')
  for (const u of urls) {
    console.error(`  tried: ${u}`)
  }
  console.error(`  lastError: ${msg}`)
  if (cause) console.error(`  cause: ${cause}`)
  console.error('  排查: lsof -i :8787   或   curl -v http://localhost:8787/api/office-instances')
  process.exit(1)
}

await main()
