#!/usr/bin/env node
/**
 * 公开 Demo 构建不得误用 OpenClaw / internal 模式（避免把真实实例数据打进对外站点）。
 * 在 `npm run build:demo` 中于 vite 之前执行；Vercel 公开项目在 `vercel-build.mjs` 中重复校验。
 */
const ds = process.env.VITE_DATA_SOURCE?.trim().toLowerCase()
const vm = process.env.VITE_MODE?.trim().toLowerCase()

if (ds === 'openclaw') {
  console.error(
    '[verify-demo-build-safe] Refusing build:demo: process.env.VITE_DATA_SOURCE=openclaw.\n' +
      '公开版应仅使用 Mock。请 unset 该变量，或勿在公开 Vercel 项目中配置此项。',
  )
  process.exit(1)
}

if (vm === 'internal') {
  console.error(
    '[verify-demo-build-safe] Refusing build:demo: process.env.VITE_MODE=internal.\n' +
      '请使用 build:internal 构建内部驾驶舱。',
  )
  process.exit(1)
}
