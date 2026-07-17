import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}

export function CanvasView() {
  const ref = useRef<HTMLDivElement>(null)
  const viewport = useStore((s) => s.viewport)
  const panBy = useStore((s) => s.panBy)
  const zoomAt = useStore((s) => s.zoomAt)

  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const panLast = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0025))
      } else {
        panBy(-e.deltaX, -e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [panBy, zoomAt])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isEditable(e.target)) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    const panButton = e.button === 1 || (e.button === 0 && spaceHeld)
    if (panButton) {
      e.currentTarget.setPointerCapture(e.pointerId)
      panLast.current = { x: e.clientX, y: e.clientY }
      setPanning(true)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (panning) {
      panBy(e.clientX - panLast.current.x, e.clientY - panLast.current.y)
      panLast.current = { x: e.clientX, y: e.clientY }
    }
  }

  const onPointerUp = () => setPanning(false)

  const gridSize = 24 * viewport.zoom
  const showGrid = gridSize >= 9

  return (
    <div
      ref={ref}
      className={`canvas ${panning ? 'panning' : spaceHeld ? 'pan-ready' : ''}`}
      style={{
        backgroundImage: showGrid
          ? 'radial-gradient(circle, var(--grid-dot) 1.1px, transparent 1.1px)'
          : 'none',
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      />
      <div className="empty-hint">
        <div>
          Scroll to pan &nbsp;·&nbsp; <span className="key">⌘</span> scroll or pinch to zoom
        </div>
      </div>
      <button
        className="zoom-chip"
        title="Reset zoom"
        onClick={() => {
          const el = ref.current
          if (!el) return
          zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / viewport.zoom)
        }}
      >
        {Math.round(viewport.zoom * 100)}%
      </button>
    </div>
  )
}
