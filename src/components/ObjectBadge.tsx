import type { ReactNode } from 'react'
import { runtimeConfig } from '../config/runtime'
import { resolveInternalInstanceGlyph } from '../config/instanceGlyphs'

interface ObjectBadgeProps {
  kind: 'project' | 'agent' | 'room' | 'task'
  code: string
  name?: string
  hideCode?: boolean
  /** OpenClaw / mock 实例 key（main、builder…），内部版用于图标内简称 */
  instanceKey?: string
  /** 内部版无 instanceKey 时用于对照 INS-01…06（如 agent-1） */
  agentId?: string
  compact?: boolean
  clickable?: boolean
  selected?: boolean
  related?: boolean
  dimmed?: boolean
  isSelected?: boolean
  isRelated?: boolean
  isDimmed?: boolean
  onClick?: () => void
  suffix?: ReactNode
}

const kindLabel = {
  project: 'P',
  agent: 'A',
  room: 'R',
  task: 'T',
}

const AGENT_ICON_BY_CODE: Record<string, string> = {
  'INS-01': 'C',
  'INS-02': 'B',
  'INS-03': 'M',
  'INS-04': 'S',
  'INS-05': 'A',
  'INS-06': 'G',
}

const resolveAgentIcon = (code?: string, name?: string): string => {
  if (code && AGENT_ICON_BY_CODE[code]) {
    return AGENT_ICON_BY_CODE[code]
  }

  if (name) {
    const trimmed = name.replace(/\s+/g, '')

    if (trimmed.length >= 1) {
      return trimmed[0].toUpperCase()
    }

    const last = trimmed.at(-1)
    if (last) {
      return last
    }
  }

  return kindLabel.agent
}

const resolveObjectIcon = (
  kind: ObjectBadgeProps['kind'],
  code: string,
  name: string | undefined,
  instanceKey: string | undefined,
  agentId: string | undefined,
): string => {
  if (kind === 'agent') {
    // 公开 Demo：仅用英文字母等中性图标；个人化单字仅 internal 构建
    if (runtimeConfig.mode === 'internal') {
      const glyph = resolveInternalInstanceGlyph(code, instanceKey, agentId)
      if (glyph) return glyph
    }
    return resolveAgentIcon(code, name)
  }

  return kindLabel[kind]
}

export function ObjectBadge({
  kind,
  code,
  name,
  hideCode = false,
  instanceKey,
  agentId,
  compact = false,
  clickable = false,
  selected = false,
  related = false,
  dimmed = false,
  isSelected,
  isRelated,
  isDimmed,
  onClick,
  suffix,
}: ObjectBadgeProps) {
  const selectedState = isSelected ?? selected
  const relatedState = isRelated ?? related
  const dimmedState = isDimmed ?? dimmed
  const icon = resolveObjectIcon(kind, code, name, instanceKey, agentId)

  const className = [
    'object-badge',
    `object-${kind}`,
    compact ? 'object-compact' : '',
    clickable ? 'object-clickable' : '',
    selectedState ? 'is-selected' : '',
    relatedState ? 'is-related' : '',
    dimmedState ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <span className="object-icon">{icon}</span>
      {name && <span className="object-name">{name}</span>}
      {!hideCode && <span className="object-code">{code}</span>}
      {suffix}
    </>
  )

  if (clickable) {
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.stopPropagation()
          onClick?.()
        }}
      >
        {content}
      </button>
    )
  }

  return <span className={className}>{content}</span>
}
