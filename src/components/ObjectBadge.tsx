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
  onClick?: () => void
  suffix?: ReactNode
}

const kindLabel = {
  project: '项',
  agent: '实',
  room: '群',
  task: '单',
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
  onClick,
  suffix,
}: ObjectBadgeProps) {
  const className = [
    'object-badge',
    `object-${kind}`,
    compact ? 'object-compact' : '',
    clickable ? 'object-clickable' : '',
    selected ? 'is-selected' : '',
    related ? 'is-related' : '',
    dimmed ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <span className="object-icon">{kindLabel[kind]}</span>
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
