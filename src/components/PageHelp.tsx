import { useEffect, useId, useRef, useState } from 'react'

type PageHelpProps = {
  title: string
  helpText: string
}

export function PageHelp({ title, helpText }: PageHelpProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="page-help" ref={rootRef}>
      <button
        type="button"
        className="page-help-trigger"
        aria-label={`这是什么：${title}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open ? (
        <div className="page-help-popover" id={popoverId} role="dialog" aria-label={`${title}说明`}>
          <strong>{title}</strong>
          <p>{helpText}</p>
        </div>
      ) : null}
    </div>
  )
}
