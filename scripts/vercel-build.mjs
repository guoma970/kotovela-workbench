#!/usr/bin/env node
/**
 * Vercel 构建入口：用环境变量选择 Demo 或 Internal 产物。
 * - 默认（未设置或 demo）：npm run build:demo
 * - Internal 项目：在 Vercel 环境变量中设置 VERCEL_BUILD_MODE=internal
 */
import { spawnSync } from 'node:child_process'

const mode = (process.env.VERCEL_BUILD_MODE || 'demo').trim().toLowerCase()
const script = mode === 'internal' ? 'build:internal' : 'build:demo'

if (mode !== 'internal' && mode !== 'demo') {
  console.error('[vercel-build] VERCEL_BUILD_MODE must be "demo" or "internal", got:', mode)
  process.exit(1)
}

if (mode === 'demo') {
  const ds = process.env.VITE_DATA_SOURCE?.trim().toLowerCase()
  const vm = process.env.VITE_MODE?.trim().toLowerCase()
  if (ds === 'openclaw') {
    console.error(
      '[vercel-build] Refusing public demo build: VITE_DATA_SOURCE=openclaw is set.\n' +
        '公开 Demo 站只能走 Mock：请从「公开项目」的 Environment Variables 中删除 VITE_DATA_SOURCE，或勿设为 openclaw。\n' +
        '若本项目是内部驾驶舱（需要 OpenClaw）：请在 Production 设置 VERCEL_BUILD_MODE=internal（勿删 VITE_DATA_SOURCE，走 build:internal 即可）。',
    )
    process.exit(1)
  }
  if (vm === 'internal') {
    console.error(
      '[vercel-build] Refusing public demo build: VITE_MODE=internal.\n' +
        '公开项目请勿设置 VITE_MODE=internal。内部站请在 Vercel 设置 VERCEL_BUILD_MODE=internal。',
    )
    process.exit(1)
  }
}

console.log(`[vercel-build] VERCEL_BUILD_MODE=${mode} → npm run ${script}`)

const result = spawnSync('npm', ['run', script], { stdio: 'inherit' })
process.exit(result.status === null ? 1 : result.status)
