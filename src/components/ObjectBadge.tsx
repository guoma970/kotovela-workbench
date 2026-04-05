import type { ReactNode } from 'react'

interface ObjectBadgeProps {
  kind: 'project' | 'agent' | 'room' | 'task'
  code: string
  name?: string
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

const resolveObjectIcon = (kind: ObjectBadgeProps['kind'], code: string, name?: string): string => {
  if (kind === 'agent') {
    return resolveAgentIcon(code, name)
  }

  return kindLabel[kind]
}

export function ObjectBadge({
  kind,
  code,
  name,
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
  const icon = resolveObjectIcon(kind, code, name)

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
      <span className="object-code">{code}</span>
      {name && <span className="object-name">{name}</span>}
      {suffix}
    </>
  )

  if (clickable) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    )
  }

  return <span className={className}>{content}</span>
}
