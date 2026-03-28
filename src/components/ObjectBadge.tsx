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
  title?: string
}

const kindLabel = {
  project: '项',
  agent: '实',
  room: '群',
  task: '单',
}

const scopeLabel = {
  project: '项目',
  agent: '实例',
  room: '群组',
  task: '任务',
}

const titleFor = (kind: ObjectBadgeProps['kind'], code: string, name?: string, customTitle?: string) => {
  if (customTitle) return customTitle
  return `${scopeLabel[kind]} ${code}${name ? `：${name}` : ''}`
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
  title,
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

  const hint = titleFor(kind, code, name, title)

  if (clickable) {
    return (
      <button type="button" className={className} onClick={onClick} title={hint} aria-label={hint}>
        {content}
      </button>
    )
  }

  return (
    <span className={className} title={hint}>
      {content}
    </span>
  )
}
