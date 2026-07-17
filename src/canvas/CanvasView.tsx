import { useEffect, useRef, useState } from 'react'
import { useStore, MIN_ZOOM } from '../store'
import { nodeBounds, type ImageNode, type Vec } from '../types'
import { decodeImageFile, displayScale } from '../lib/image'
import { clamp, uid } from '../lib/util'
import { NodeView } from './NodeView'

const DRAG_MIN = 3

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Interaction =
  | { mode: 'pan'; last: Vec }
  | { mode: 'drag'; id: string; start: Vec; origins: Record<string, Vec>; moved: boolean }
  | { mode: 'marquee'; start: Vec; base: string[]; additive: boolean }

export function CanvasView() {
  const ref = useRef<HTMLDivElement>(null)
  const inter = useRef<Interaction | null>(null)

  const viewport = useStore((s) => s.viewport)
  const doc = useStore((s) => s.doc)
  const selection = useStore((s) => s.selection)

  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const [marquee, setMarquee] = useState<Rect | null>(null)

  const screenToWorld = (sx: number, sy: number): Vec => {
    const { x, y, zoom } = useStore.getState().viewport
    return { x: (sx - x) / zoom, y: (sy - y) / zoom }
  }

  const eventPoint = (e: { clientX: number; clientY: number }): Vec => {
    const rect = ref.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useStore.getState()
      if (e.ctrlKey || e.metaKey) {
        const p = eventPoint(e)
        s.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0025))
      } else {
        s.panBy(-e.deltaX, -e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

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

  const fitView = () => {
    const el = ref.current
    const s = useStore.getState()
    const nodes = Object.values(s.doc.nodes)
    if (!el || !nodes.length) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const b = nodeBounds(n)
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.w)
      maxY = Math.max(maxY, b.y + b.h)
    }
    const margin = 60
    const bw = maxX - minX + margin * 2
    const bh = maxY - minY + margin * 2
    const zoom = clamp(Math.min(el.clientWidth / bw, el.clientHeight / bh), MIN_ZOOM, 2)
    s.setViewport({
      zoom,
      x: (el.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom,
      y: (el.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom,
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && e.key === 'a') {
        e.preventDefault()
        s.setSelection(Object.keys(s.doc.nodes))
      } else if (mod && e.key === 'd') {
        e.preventDefault()
        s.duplicateSelection()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        s.deleteSelection()
      } else if (e.key === 'Escape') {
        s.setSelection([])
      } else if (e.key === '!' || (e.key === '1' && e.shiftKey)) {
        fitView()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const importFiles = async (files: Iterable<File>, at?: Vec) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    const el = ref.current
    const s = useStore.getState()
    const center =
      at ?? (el ? screenToWorld(el.clientWidth / 2, el.clientHeight / 2) : { x: 0, y: 0 })
    const nodes: ImageNode[] = []
    for (const file of images) {
      try {
        const { data, w, h } = await decodeImageFile(file)
        const scale = displayScale(w, h)
        const offset = nodes.length * 24
        nodes.push({
          id: uid(),
          kind: 'image' as const,
          x: Math.round(center.x - (w * scale) / 2) + offset,
          y: Math.round(center.y - (h * scale) / 2) + offset,
          w,
          h,
          scale,
          name: file.name ? file.name.replace(/\.[^.]+$/, '') : 'Pasted image',
          data,
          source: 'import' as const,
        })
      } catch {
        console.error(`Could not import ${file.name}`)
      }
    }
    s.addNodes(nodes)
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target) || !e.clipboardData) return
      const files = [...e.clipboardData.items]
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter((f) => f !== null)
      if (files.length) {
        e.preventDefault()
        importFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      inter.current = { mode: 'pan', last: { x: e.clientX, y: e.clientY } }
      e.currentTarget.setPointerCapture(e.pointerId)
      setPanning(true)
      return
    }
    if (e.button !== 0 || target.closest('input, textarea, button, select, [data-no-drag]')) return

    const s = useStore.getState()
    const nodeEl = target.closest<HTMLElement>('[data-node-id]')
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId!
      let sel = s.selection
      if (e.shiftKey) {
        sel = sel.includes(id) ? sel.filter((i) => i !== id) : [...sel, id]
        s.setSelection(sel)
      } else if (!sel.includes(id)) {
        sel = [id]
        s.setSelection(sel)
      }
      if (sel.includes(id)) {
        const origins: Record<string, Vec> = {}
        for (const selId of sel) {
          const n = s.doc.nodes[selId]
          if (n) origins[selId] = { x: n.x, y: n.y }
        }
        inter.current = {
          mode: 'drag',
          id,
          start: { x: e.clientX, y: e.clientY },
          origins,
          moved: false,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    } else {
      const p = eventPoint(e)
      inter.current = { mode: 'marquee', start: p, base: e.shiftKey ? s.selection : [], additive: e.shiftKey }
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 })
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const it = inter.current
    if (!it) return
    const s = useStore.getState()

    if (it.mode === 'pan') {
      s.panBy(e.clientX - it.last.x, e.clientY - it.last.y)
      it.last = { x: e.clientX, y: e.clientY }
    } else if (it.mode === 'drag') {
      const dx = e.clientX - it.start.x
      const dy = e.clientY - it.start.y
      if (!it.moved) {
        if (Math.hypot(dx, dy) < DRAG_MIN) return
        s.checkpoint()
        it.moved = true
      }
      const { zoom } = s.viewport
      const positions: Record<string, Vec> = {}
      for (const [id, origin] of Object.entries(it.origins)) {
        positions[id] = { x: origin.x + dx / zoom, y: origin.y + dy / zoom }
      }
      s.setNodePositions(positions)
    } else {
      const p = eventPoint(e)
      const rect = {
        x: Math.min(it.start.x, p.x),
        y: Math.min(it.start.y, p.y),
        w: Math.abs(p.x - it.start.x),
        h: Math.abs(p.y - it.start.y),
      }
      setMarquee(rect)
      const a = screenToWorld(rect.x, rect.y)
      const b = screenToWorld(rect.x + rect.w, rect.y + rect.h)
      const hits = Object.values(s.doc.nodes)
        .filter((n) => {
          const nb = nodeBounds(n)
          return nb.x < b.x && nb.x + nb.w > a.x && nb.y < b.y && nb.y + nb.h > a.y
        })
        .map((n) => n.id)
      s.setSelection(it.additive ? [...new Set([...it.base, ...hits])] : hits)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const it = inter.current
    const s = useStore.getState()
    if (it?.mode === 'drag' && !it.moved && !e.shiftKey) {
      s.setSelection([it.id])
    } else if (it?.mode === 'marquee' && marquee && marquee.w < DRAG_MIN && marquee.h < DRAG_MIN) {
      s.setSelection(it.additive ? it.base : [])
    }
    inter.current = null
    setMarquee(null)
    setPanning(false)
  }

  const nodes = Object.values(doc.nodes)
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
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        const p = eventPoint(e)
        importFiles(e.dataTransfer.files, screenToWorld(p.x, p.y))
      }}
    >
      <div
        className="world"
        style={
          {
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            '--z': viewport.zoom,
          } as React.CSSProperties
        }
      >
        {nodes.map((n) => (
          <NodeView key={n.id} node={n} selected={selection.includes(n.id)} />
        ))}
      </div>
      {marquee && (
        <div
          className="marquee"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}
      {nodes.length === 0 && (
        <div className="empty-hint">
          <div>Drop an image here, or paste one from your clipboard</div>
          <div>
            Scroll to pan &nbsp;·&nbsp; <span className="key">⌘</span> scroll or pinch to zoom
          </div>
        </div>
      )}
      <button
        className="zoom-chip"
        title="Reset zoom"
        onClick={() => {
          const el = ref.current
          if (!el) return
          useStore.getState().zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1 / viewport.zoom)
        }}
      >
        {Math.round(viewport.zoom * 100)}%
      </button>
    </div>
  )
}
