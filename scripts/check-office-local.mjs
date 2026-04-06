#!/usr/bin/env node
/**
 * 本机自检：在 **已运行** `npm run dev:internal` 时探测 `/api/office-instances`。
 * 用法：`npm run check:office`
 * 可选：`OFFICE_CHECK_URL=... npm run check:office`
 *
 * 说明：macOS 上 Vite 有时只监听 IPv6（::1），对 `127.0.0.1` 会拒绝连接；
 * 本脚本会依次尝试 localhost / 127.0.0.1 / ::1。
 */

const DEFAULT_URLS = [
  'http://localhost:5173/api/office-instances',
  'http://127.0.0.1:5173/api/office-instances',
  'http://[::1]:5173/api/office-instances',
]

async function main() {
  const fromEnv = process.env.OFFICE_CHECK_URL?.trim()
  const urls = fromEnv ? [fromEnv] : DEFAULT_URLS
  let lastErr = null

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} ${res.statusText}`)
        continue
      }
      const data = await res.json()
      const instances = Array.isArray(data.instances) ? data.instances : []
      console.log('[check:office] OK')
      console.log('  url:', url)
      console.log('  source:', data.source ?? '(missing)')
      console.log('  generatedAt:', data.generatedAt ?? '(missing)')
      console.log('  instances:', instances.length)
      for (const row of instances.slice(0, 8)) {
        const task = typeof row.task === 'string' ? row.task : '(no task)'
        console.log(`  - ${row.key}: ${task}`)
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
  console.error('[check:office] 全部 URL 均失败（请确认另一终端里 `npm run dev:internal` 仍在运行，且未报端口占用）')
  for (const u of urls) {
    console.error(`  tried: ${u}`)
  }
  console.error(`  lastError: ${msg}`)
  if (cause) console.error(`  cause: ${cause}`)
  console.error('  排查: lsof -i :5173   或   curl -v http://localhost:5173/')
  process.exit(1)
}

await main()
