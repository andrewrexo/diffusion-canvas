import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { loadImage } from '../lib/image'
import { clamp } from '../lib/util'
import {
  cloneImage,
  drawBrush,
  drawLine,
  drawRect,
  floodFill,
  getPixel,
  hexToRgba,
  rgbaToHex,
  type RGBA,
} from './tools'
import { extractPalette, SWEETIE_16 } from './palettes'
import {
  IconBack,
  IconBucket,
  IconEraser,
  IconLine,
  IconPencil,
  IconPicker,
  IconRect,
  IconRedo,
  IconUndo,
} from '../ui/icons'

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'picker'

const TOOLS: { id: Tool; label: string; icon: () => React.ReactNode }[] = [
  { id: 'pencil', label: 'Pencil (B)', icon: IconPencil },
  { id: 'eraser', label: 'Eraser (E)', icon: IconEraser },
  { id: 'fill', label: 'Fill (G)', icon: IconBucket },
  { id: 'line', label: 'Line (L)', icon: IconLine },
  { id: 'rect', label: 'Rectangle (R)', icon: IconRect },
  { id: 'picker', label: 'Eyedropper (I)', icon: IconPicker },
]

const ERASE: RGBA = [0, 0, 0, 0]
const UNDO_LIMIT = 50

interface View {
  x: number
  y: number
  z: number
}

type Stroke =
  | { kind: 'paint'; last: { x: number; y: number } }
  | { kind: 'shape'; start: { x: number; y: number }; base: ImageData }

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}

function makeCheckerPattern() {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#1a1b20'
  ctx.fillRect(0, 0, 16, 16)
  ctx.fillStyle = '#232429'
  ctx.fillRect(0, 0, 8, 8)
  ctx.fillRect(8, 8, 8, 8)
  return c
}

function HexInput({ value, onCommit }: { value: string; onCommit: (c: RGBA) => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <input
      className="ed-hex"
      value={draft}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const c = hexToRgba(draft)
        if (c) onCommit(c)
        else setDraft(value)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}

export function PixelEditor({ id }: { id: string }) {
  const node = useStore((s) => s.doc.nodes[id])

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<ImageData | null>(null)
  const offRef = useRef<HTMLCanvasElement | null>(null)
  const patternRef = useRef<HTMLCanvasElement | null>(null)
  const viewRef = useRef<View>({ x: 0, y: 0, z: 8 })
  const undoRef = useRef<ImageData[]>([])
  const redoRef = useRef<ImageData[]>([])
  const strokeRef = useRef<Stroke | null>(null)
  const panRef = useRef<{ x: number; y: number } | null>(null)
  const hoverRef = useRef<{ x: number; y: number } | null>(null)

  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState<RGBA>([240, 164, 65, 255])
  const [brush, setBrush] = useState(1)
  const [dirty, setDirty] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const [zoomHud, setZoomHud] = useState(8)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [imagePalette, setImagePalette] = useState<string[]>([])

  const refreshPalette = () => {
    if (imgRef.current) setImagePalette(extractPalette(imgRef.current))
  }

  const redraw = () => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#131417'
    ctx.fillRect(0, 0, cw, ch)

    const { x: ox, y: oy, z } = viewRef.current
    const w = img.width * z
    const h = img.height * z

    patternRef.current ??= makeCheckerPattern()
    ctx.fillStyle = ctx.createPattern(patternRef.current, 'repeat')!
    ctx.fillRect(ox, oy, w, h)

    let off = offRef.current
    if (!off || off.width !== img.width || off.height !== img.height) {
      off = document.createElement('canvas')
      off.width = img.width
      off.height = img.height
      offRef.current = off
    }
    off.getContext('2d')!.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(off, ox, oy, w, h)

    ctx.strokeStyle = '#3d414b'
    ctx.lineWidth = 1
    ctx.strokeRect(ox - 0.5, oy - 0.5, w + 1, h + 1)

    if (z >= 8) {
      for (const [major, style] of [
        [false, 'rgba(148, 158, 180, 0.07)'],
        [true, 'rgba(148, 158, 180, 0.16)'],
      ] as const) {
        ctx.strokeStyle = style
        ctx.beginPath()
        for (let x = 1; x < img.width; x++) {
          if (x % 8 === 0 !== major) continue
          ctx.moveTo(ox + x * z + 0.5, oy)
          ctx.lineTo(ox + x * z + 0.5, oy + h)
        }
        for (let y = 1; y < img.height; y++) {
          if (y % 8 === 0 !== major) continue
          ctx.moveTo(ox, oy + y * z + 0.5)
          ctx.lineTo(ox + w, oy + y * z + 0.5)
        }
        ctx.stroke()
      }
    }

    const hover = hoverRef.current
    if (hover && z >= 3 && !strokeRef.current) {
      ctx.strokeStyle = 'rgba(240, 164, 65, 0.9)'
      ctx.strokeRect(ox + hover.x * z + 0.5, oy + hover.y * z + 0.5, z - 1, z - 1)
    }
  }

  const syncHistory = () => {
    setCanUndo(undoRef.current.length > 0)
    setCanRedo(redoRef.current.length > 0)
  }

  const pushUndo = () => {
    const img = imgRef.current
    if (!img) return
    undoRef.current.push(cloneImage(img))
    if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift()
    redoRef.current = []
    syncHistory()
  }

  const undo = () => {
    const img = imgRef.current
    const prev = undoRef.current.pop()
    if (!img || !prev) return
    redoRef.current.push(cloneImage(img))
    imgRef.current = prev
    syncHistory()
    setDirty(true)
    refreshPalette()
    redraw()
  }

  const redo = () => {
    const img = imgRef.current
    const next = redoRef.current.pop()
    if (!img || !next) return
    undoRef.current.push(cloneImage(img))
    imgRef.current = next
    syncHistory()
    setDirty(true)
    refreshPalette()
    redraw()
  }

  const save = () => {
    const img = imgRef.current
    if (!img) return
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    c.getContext('2d')!.putImageData(img, 0, 0)
    useStore.getState().commitDrawing(id, c.toDataURL('image/png'))
    useStore.getState().closeEditor()
  }

  const requestClose = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    useStore.getState().closeEditor()
  }

  const fitView = () => {
    const stage = stageRef.current
    const img = imgRef.current
    if (!stage || !img) return
    const raw = Math.min(stage.clientWidth / img.width, stage.clientHeight / img.height) * 0.85
    const z = raw >= 1 ? Math.max(1, Math.floor(raw)) : Math.max(0.25, raw)
    viewRef.current = {
      x: (stage.clientWidth - img.width * z) / 2,
      y: (stage.clientHeight - img.height * z) / 2,
      z,
    }
    setZoomHud(z)
  }

  const apiRef = useRef({ undo, redo, save, requestClose })
  useEffect(() => {
    apiRef.current = { undo, redo, save, requestClose }
  })

  useEffect(() => {
    let live = true
    const n = useStore.getState().doc.nodes[id]
    if (!n || n.kind !== 'image') {
      useStore.getState().closeEditor()
      return
    }
    void loadImage(n.data).then((el) => {
      if (!live) return
      const c = document.createElement('canvas')
      c.width = n.w
      c.height = n.h
      const ctx = c.getContext('2d')!
      ctx.drawImage(el, 0, 0)
      imgRef.current = ctx.getImageData(0, 0, n.w, n.h)
      fitView()
      setReady(true)
      refreshPalette()
    })
    return () => {
      live = false
    }
  }, [id])

  useEffect(() => {
    if (ready) redraw()
  }, [ready])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(() => redraw())
    observer.observe(stage)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      if (e.ctrlKey || e.metaKey) {
        const rect = stage.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        const z = clamp(v.z * Math.exp(-e.deltaY * 0.0025), 0.25, 48)
        const k = z / v.z
        viewRef.current = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z }
        setZoomHud(z)
      } else {
        viewRef.current = { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }
      }
      redraw()
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      stage.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isEditable(e.target)) {
        e.preventDefault()
        setSpaceHeld(true)
        return
      }
      if (isEditable(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) apiRef.current.redo()
        else apiRef.current.undo()
      } else if (mod && e.key === 's') {
        e.preventDefault()
        apiRef.current.save()
      } else if (!mod) {
        const key = e.key.toLowerCase()
        if (key === 'b') setTool('pencil')
        else if (key === 'e') setTool('eraser')
        else if (key === 'g') setTool('fill')
        else if (key === 'l') setTool('line')
        else if (key === 'r') setTool('rect')
        else if (key === 'i') setTool('picker')
        else if (key === '[') setBrush((b) => Math.max(1, b - 1))
        else if (key === ']') setBrush((b) => Math.min(4, b + 1))
        else if (key === 'escape') apiRef.current.requestClose()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const toPixel = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const v = viewRef.current
    return {
      x: Math.floor((e.clientX - rect.left - v.x) / v.z),
      y: Math.floor((e.clientY - rect.top - v.y) / v.z),
    }
  }

  const inBounds = (p: { x: number; y: number }) => {
    const img = imgRef.current
    return !!img && p.x >= 0 && p.y >= 0 && p.x < img.width && p.y < img.height
  }

  const pick = (p: { x: number; y: number }) => {
    const img = imgRef.current
    if (!img || !inBounds(p)) return
    const c = getPixel(img, p.x, p.y)
    if (c[3] > 0) setColor([c[0], c[1], c[2], 255])
  }

  const endStroke = () => {
    if (!strokeRef.current) return
    strokeRef.current = null
    setDirty(true)
    refreshPalette()
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const img = imgRef.current
    if (!img) return
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      panRef.current = { x: e.clientX, y: e.clientY }
      setPanning(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    const p = toPixel(e)
    if (e.altKey || tool === 'picker') {
      pick(p)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'pencil' || tool === 'eraser') {
      pushUndo()
      drawBrush(img, p.x, p.y, brush, tool === 'eraser' ? ERASE : color)
      strokeRef.current = { kind: 'paint', last: p }
      redraw()
    } else if (tool === 'fill') {
      if (!inBounds(p)) return
      pushUndo()
      floodFill(img, p.x, p.y, color)
      strokeRef.current = { kind: 'paint', last: p }
      endStroke()
      redraw()
    } else {
      pushUndo()
      strokeRef.current = { kind: 'shape', start: p, base: cloneImage(img) }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const img = imgRef.current
    if (!img) return
    if (panRef.current) {
      const v = viewRef.current
      viewRef.current = {
        ...v,
        x: v.x + e.clientX - panRef.current.x,
        y: v.y + e.clientY - panRef.current.y,
      }
      panRef.current = { x: e.clientX, y: e.clientY }
      redraw()
      return
    }
    const p = toPixel(e)
    hoverRef.current = inBounds(p) ? p : null
    setPos(hoverRef.current)

    const stroke = strokeRef.current
    if (stroke?.kind === 'paint' && tool !== 'fill') {
      drawLine(img, stroke.last.x, stroke.last.y, p.x, p.y, brush, tool === 'eraser' ? ERASE : color)
      stroke.last = p
    } else if (stroke?.kind === 'shape') {
      img.data.set(stroke.base.data)
      if (tool === 'line') drawLine(img, stroke.start.x, stroke.start.y, p.x, p.y, brush, color)
      else drawRect(img, stroke.start.x, stroke.start.y, p.x, p.y, brush, color)
    }
    redraw()
  }

  const onPointerUp = () => {
    panRef.current = null
    setPanning(false)
    endStroke()
    redraw()
  }

  if (!node || node.kind !== 'image') return null

  return (
    <div className="editor">
      <div className="ed-top">
        <button className="iconbtn" title="Back to canvas (Esc)" onClick={requestClose}>
          <IconBack />
        </button>
        <span className="ed-title">{node.name}</span>
        <span className="node-dims">
          {node.w}×{node.h}
        </span>
        <div className="topbar-spacer" />
        <button className="iconbtn" disabled={!canUndo} title="Undo (⌘Z)" onClick={undo}>
          <IconUndo />
        </button>
        <button className="iconbtn" disabled={!canRedo} title="Redo (⇧⌘Z)" onClick={redo}>
          <IconRedo />
        </button>
        <button className="btn primary" disabled={!dirty} onClick={save}>
          Save
        </button>
      </div>
      <div className="ed-main">
        <div className="ed-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? 'active' : ''}
              title={t.label}
              onClick={() => setTool(t.id)}
            >
              {t.icon()}
            </button>
          ))}
        </div>
        <div
          ref={stageRef}
          className={`ed-stage${panning ? ' panning' : spaceHeld ? ' pan-ready' : ''}`}
        >
          {ready && (
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => {
                hoverRef.current = null
                setPos(null)
                redraw()
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
          <div className="ed-hud">
            {pos ? `${pos.x},${pos.y}` : '–'} &nbsp;·&nbsp; {Math.round(zoomHud * 100)}%
          </div>
        </div>
        <aside className="ed-panel">
          <div className="ed-color-row">
            <div className="ed-swatch big" style={{ background: rgbaToHex(color) }} />
            <HexInput key={rgbaToHex(color)} value={rgbaToHex(color)} onCommit={setColor} />
          </div>
          <div className="ed-section">Brush</div>
          <div className="ed-brushes">
            {[1, 2, 3, 4].map((b) => (
              <button
                key={b}
                className={brush === b ? 'active' : ''}
                title={`${b}px`}
                onClick={() => setBrush(b)}
              >
                <span style={{ width: b * 2 + 2, height: b * 2 + 2 }} />
              </button>
            ))}
          </div>
          {imagePalette.length > 0 && (
            <>
              <div className="ed-section">Image colors</div>
              <div className="ed-swatches">
                {imagePalette.map((hex) => (
                  <button
                    key={hex}
                    className="ed-swatch"
                    style={{ background: hex }}
                    title={hex}
                    onClick={() => setColor(hexToRgba(hex)!)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="ed-section">Sweetie 16</div>
          <div className="ed-swatches">
            {SWEETIE_16.map((hex) => (
              <button
                key={hex}
                className="ed-swatch"
                style={{ background: hex }}
                title={hex}
                onClick={() => setColor(hexToRgba(hex)!)}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
