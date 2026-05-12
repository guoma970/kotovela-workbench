import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { appendAuditLog } from './auditLogStore'

type SystemModeHandlerOptions = {
  isInternal: boolean
}

export function createSystemModeHandler({ isInternal }: SystemModeHandlerOptions) {
  const projectRoot = path.resolve(process.env.PROJECT_ROOT ?? process.env.OPENCLAW_PROJECT_ROOT ?? process.cwd())
  const modeStateFile = path.resolve(
    process.env.MODE_STATE_FILE ?? path.join(projectRoot, 'server', 'data', `system-mode.${isInternal ? 'internal' : 'opensource'}.json`),
  )

  const normalizeSystemState = (input: Record<string, unknown>) => {
    const rawSystem = String(input.system_mode ?? input.systemMode ?? process.env.SYSTEM_MODE ?? (isInternal ? 'test' : 'dev')).toLowerCase()
    const rawPublish = String(input.publish_mode ?? input.publishMode ?? process.env.PUBLISH_MODE ?? (isInternal ? 'semi_auto' : 'manual_only')).toLowerCase()
    const forceStop = Boolean(input.force_stop ?? input.forceStop ?? String(process.env.FORCE_STOP || 'false').toLowerCase() === 'true')
    const warning = Boolean(input.warning ?? false)
    const overload = Boolean(input.overload ?? false)
    const liveGuardrailsEnabled = Boolean((input.live_guardrails as Record<string, unknown> | undefined)?.enabled ?? rawSystem === 'live')
    const liveGuardrailsMessage = String((input.live_guardrails as Record<string, unknown> | undefined)?.message ?? (rawSystem === 'live' ? 'LIVE MODE · Real business traffic enabled' : 'Non-live environment, safe for demo and validation.'))
    const decisionLog = Array.isArray(input.decision_log) ? input.decision_log : []
    return {
      app_mode: isInternal ? 'internal' : 'opensource',
      system_mode: rawSystem === 'live' ? 'live' : rawSystem === 'test' ? 'test' : 'dev',
      publish_mode: rawPublish === 'semi_auto' ? 'semi_auto' : rawPublish === 'auto_disabled' ? 'auto_disabled' : 'manual_only',
      force_stop: forceStop,
      warning,
      overload,
      live_guardrails: {
        enabled: liveGuardrailsEnabled,
        message: liveGuardrailsMessage,
      },
      decision_log: decisionLog,
      updated_at: new Date().toISOString(),
    }
  }

  const readSystemState = async () => {
    try {
      const raw = await fs.readFile(modeStateFile, 'utf8')
      return normalizeSystemState(JSON.parse(raw) as Record<string, unknown>)
    } catch {
      const initial = normalizeSystemState({})
      await fs.mkdir(path.dirname(modeStateFile), { recursive: true })
      await fs.writeFile(modeStateFile, `${JSON.stringify(initial, null, 2)}\n`, 'utf8')
      return initial
    }
  }

  const writeSystemState = async (nextState: Record<string, unknown>) => {
    const normalized = normalizeSystemState(nextState)
    await fs.mkdir(path.dirname(modeStateFile), { recursive: true })
    await fs.writeFile(modeStateFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
    return normalized
  }

  return async function systemModeHandler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method === 'GET') {
      const payload = await readSystemState()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(payload))
      return
    }

    if (req.method === 'PATCH') {
      if (!isInternal) {
        const payload = await readSystemState()
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ message: 'opensource mode is read-only for system-mode', ...payload }))
        return
      }

      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      const bodyText = Buffer.concat(chunks).toString('utf8')
      const body = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {}
      const current = await readSystemState()
      const actor = String(body.actor || 'builder')
      const actionTime = new Date().toISOString()
      const action = {
        timestamp: actionTime,
        action: 'system_mode_updated',
        reason: 'manual_change',
        detail: `system_mode=${String(body.system_mode ?? current.system_mode)} publish_mode=${String(body.publish_mode ?? current.publish_mode)} force_stop=${String(body.force_stop ?? current.force_stop)} warning=${String(body.warning ?? current.warning)} overload=${String(body.overload ?? current.overload)}`,
        actor,
      }
      const nextState = await writeSystemState({
        ...current,
        ...body,
        decision_log: [action, ...(Array.isArray(current.decision_log) ? current.decision_log : [])].slice(0, 50),
      })

      await appendAuditLog({
        action: 'system_mode_updated',
        user: actor,
        time: actionTime,
        target: '/api/system-mode',
        result: action.detail,
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(nextState))
      return
    }

    next()
  }
}
