/**
 * 仅内部版（VITE_MODE=internal）ObjectBadge 图标内单字；公开 Demo 构建不会使用本表（避免个人化简称外泄）。
 * 完整实例名见 `instanceDisplayNames.ts`。
 */
export const OFFICE_INSTANCE_KEY_TO_GLYPH: Record<string, string> = {
  main: '树',
  builder: '筑',
  media: '果',
  family: '羲',
  business: '言',
  personal: '柒',
  ztl970: '柒',
}

export const INS_CODE_TO_GLYPH: Record<string, string> = {
  'INS-01': '树',
  'INS-02': '筑',
  'INS-03': '果',
  'INS-04': '羲',
  'INS-05': '言',
  'INS-06': '柒',
}

/** 由 legacy agent id（agent-1 … agent-6）解析 INS 编号，用于 Mock 数据无 instanceKey 时。 */
export function insCodeFromAgentId(agentId: string | undefined): string | undefined {
  if (!agentId) return undefined
  const m = /^agent-(\d+)$/.exec(agentId)
  if (!m) return undefined
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 1 || n > 9) return undefined
  return `INS-0${n}`
}

export function resolveInternalInstanceGlyph(
  code: string,
  instanceKey?: string,
  agentId?: string,
): string | undefined {
  const key = instanceKey?.trim().toLowerCase()
  if (key && OFFICE_INSTANCE_KEY_TO_GLYPH[key]) {
    return OFFICE_INSTANCE_KEY_TO_GLYPH[key]
  }
  if (code && INS_CODE_TO_GLYPH[code]) {
    return INS_CODE_TO_GLYPH[code]
  }
  const derived = insCodeFromAgentId(agentId)
  if (derived && INS_CODE_TO_GLYPH[derived]) {
    return INS_CODE_TO_GLYPH[derived]
  }
  return undefined
}
