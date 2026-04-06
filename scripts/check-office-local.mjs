#!/usr/bin/env node
/**
 * 本机自检：在 **已运行** `npm run dev:internal` 时探测 `/api/office-instances`。
 * 用法：`npm run check:office`
 * 可选：`OFFICE_CHECK_URL=http://127.0.0.1:5173/api/office-instances npm run check:office`
 */

const url = process.env.OFFICE_CHECK_URL?.trim() || 'http://127.0.0.1:5173/api/office-instances'

async function main() {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.error(`[check:office] HTTP ${res.status} ${res.statusText}`)
      process.exit(1)
    }
    const data = await res.json()
    const instances = Array.isArray(data.instances) ? data.instances : []
    console.log('[check:office] OK')
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
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[check:office] 连接失败（请先在本机项目目录执行并保持运行：npm run dev:internal）')
    console.error(`  ${url}`)
    console.error(`  ${msg}`)
    process.exit(1)
  }
}

await main()
