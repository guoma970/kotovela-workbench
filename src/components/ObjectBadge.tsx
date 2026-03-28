import { useEffect, useRef, useState } from 'react'
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
  openInPanel?: boolean
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

const getAgentShortIcon = (name?: string) => {
  if (!name) return '实'
  if (name.startsWith('小') && name.length >= 2) {
    return name.slice(1, 2)
  }

  return name.slice(0, 2)
}

const iconFor = (kind: ObjectBadgeProps['kind'], name?: string) => {
  if (kind === 'agent') return getAgentShortIcon(name)
  return kindLabel[kind]
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
  openInPanel = false,
}: ObjectBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const layerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hint = titleFor(kind, code, name, title)

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

  const icon = iconFor(kind, name)

  const content = (
    <>
      <span className="object-icon">{icon}</span>
      <span className="object-code">{code}</span>
      {name && <span className="object-name">{name}</span>}
      {suffix}
    </>
  )

  const openPanel = () => setIsOpen(true)
  const closePanel = () => setIsOpen(false)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        layerRef.current &&
        cardRef.current &&
        !cardRef.current.contains(event.target as Node) &&
        layerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  const handleClick = () => {
    if (!clickable) {
      return
    }

    if (openInPanel) {
      openPanel()
      return
    }

    onClick?.()
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={!clickable}
        title={openInPanel ? '点击查看' : hint}
        aria-label={hint}
      >
        {content}
      </button>

      {isOpen && (
        <div className="object-popover-layer" ref={layerRef} role="presentation">
          <button className="object-popover-backdrop" type="button" onClick={closePanel} aria-label="关闭" />
          <section
            className="panel object-popover-card"
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label={hint}
          >
            <button type="button" className="object-popover-close" onClick={closePanel} aria-label="关闭">
              ×
            </button>
            <div className="object-popover-head">
              <span className="object-icon">{icon}</span>
              <div className="object-popover-meta">
                <strong>{scopeLabel[kind]} · {code}</strong>
                {name ? <p>{name}</p> : <p>—</p>}
              </div>
            </div>
            <p className="object-popover-note">已识别完整对象信息，支持直接跳转到对应对象。</p>
            <div className="object-popover-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  closePanel()
                  onClick?.()
                }}
              >
                查看关联
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
