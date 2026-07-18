import { useEffect, useRef, useState } from 'react'
import type { CanvasNode, GenNode, ImageNode } from '../types'
import { GEN_PORT_Y, GEN_W } from '../types'
import { useStore } from '../store'
import { STYLE_GROUPS } from '../api/styles'
import { downloadPng, loadImage } from '../lib/image'
import { clamp } from '../lib/util'
import { IconDownload } from '../ui/icons'

function FramePreview({ node }: { node: ImageNode }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    let cancelled = false
    void Promise.all(node.frames.map(loadImage)).then((imgs) => {
      const canvas = ref.current
      if (cancelled || !canvas) return
      canvas.width = node.w
      canvas.height = node.h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(imgs[0], 0, 0)
      if (imgs.length < 2) return
      let idx = 0
      let last = 0
      const tick = (t: number) => {
        if (t - last >= 1000 / node.fps) {
          last = t
          idx = (idx + 1) % imgs.length
          ctx.clearRect(0, 0, node.w, node.h)
          ctx.drawImage(imgs[idx], 0, 0)
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [node.frames, node.fps, node.w, node.h])

  return (
    <canvas
      ref={ref}
      className="node-img"
      style={{ width: node.w * node.scale, height: node.h * node.scale }}
    />
  )
}

function NodeName({ node }: { node: CanvasNode }) {
  const renameNode = useStore((s) => s.renameNode)
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <span
        className="node-name"
        onDoubleClick={(e) => {
          e.stopPropagation()
          setDraft(node.name)
        }}
      >
        {node.name}
      </span>
    )
  }
  return (
    <input
      className="node-rename"
      data-no-drag
      autoFocus
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim()) renameNode(node.id, draft.trim())
        setDraft(null)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(node.name)
      }}
    />
  )
}

function ExportButton({ node }: { node: ImageNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="node-export" data-no-drag>
      <button
        className="node-action"
        title="Export PNG"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      >
        <IconDownload />
      </button>
      {open && (
        <div className="export-menu">
          {[1, 4, 8].map((f) => (
            <button
              key={f}
              onClick={() => {
                setOpen(false)
                void downloadPng(node.frames[0], node.name, node.w, node.h, f)
              }}
            >
              {f}× <span>{node.w * f}×{node.h * f}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

function ImageNodeView({ node, selected }: { node: ImageNode; selected: boolean }) {
  const w = node.w * node.scale
  return (
    <div
      className={`node image-node${selected ? ' selected' : ''}`}
      data-node-id={node.id}
      style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: w + 2 }}
    >
      <div className="node-head">
        <NodeName node={node} />
        <ExportButton node={node} />
        <span className="node-dims">
          {node.w}×{node.h}
          {node.frames.length > 1 && ` · ${node.frames.length}f`}
        </span>
      </div>
      <div className="node-body checker">
        <FramePreview node={node} />
      </div>
      <div className="port port-out" data-port="output" title="Drag to a generator input" />
    </div>
  )
}

function SizeInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const parsed = parseInt(draft ?? '', 10)
    if (!Number.isNaN(parsed)) onCommit(clamp(Math.round(parsed / 8) * 8, 16, 512))
    setDraft(null)
  }
  return (
    <input
      className="gen-size"
      data-no-drag
      inputMode="numeric"
      value={draft ?? value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

function GenNodeView({ node, selected }: { node: GenNode; selected: boolean }) {
  const update = useStore((s) => s.updateGenNode)
  const run = useStore((s) => s.runGenerator)
  const hasSource = useStore((s) =>
    s.doc.edges.some((e) => e.to === node.id && e.port === 'source')
  )
  const running = node.status === 'running'

  return (
    <div
      className={`node gen-node${selected ? ' selected' : ''}`}
      data-node-id={node.id}
      style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: GEN_W }}
    >
      <div className="node-head">
        <span className={`gen-dot${running ? ' running' : node.status === 'error' ? ' error' : ''}`} />
        <NodeName node={node} />
        <span className="node-dims">
          {node.width}×{node.height}
        </span>
      </div>
      <div className="gen-body">
        <textarea
          className="gen-prompt"
          data-no-drag
          rows={3}
          placeholder="Describe the pixel art to generate…"
          value={node.prompt}
          onChange={(e) => update(node.id, { prompt: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void run(node.id)
          }}
        />
        <select
          className="gen-style"
          data-no-drag
          value={node.style}
          onChange={(e) => update(node.id, { style: e.target.value })}
        >
          {STYLE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="gen-row">
          <SizeInput value={node.width} onCommit={(v) => update(node.id, { width: v })} />
          <span className="gen-x">×</span>
          <SizeInput value={node.height} onCommit={(v) => update(node.id, { height: v })} />
          <input
            className="gen-seed"
            data-no-drag
            inputMode="numeric"
            placeholder="seed"
            title="Seed (blank for random)"
            value={node.seed ?? ''}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10)
              update(node.id, { seed: Number.isNaN(parsed) ? null : Math.abs(parsed) })
            }}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        {hasSource && (
          <div className="gen-row">
            <label className="gen-label" title="How far the result may drift from the source image">
              Strength
            </label>
            <input
              data-no-drag
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={node.strength}
              onChange={(e) => update(node.id, { strength: parseFloat(e.target.value) })}
            />
            <span className="gen-value">{node.strength.toFixed(2)}</span>
          </div>
        )}
        <button className="gen-run" disabled={running} onClick={() => void run(node.id)}>
          {running ? 'Generating…' : 'Generate'}
        </button>
        {node.status === 'error' && node.error && <div className="gen-error">{node.error}</div>}
      </div>
      <div
        className="port port-in"
        data-port="source"
        style={{ top: GEN_PORT_Y.source - 5 }}
        title="Source image (img2img)"
      >
        <span className="port-label">src</span>
      </div>
      <div
        className="port port-in"
        data-port="palette"
        style={{ top: GEN_PORT_Y.palette - 5 }}
        title="Palette image (constrains colors)"
      >
        <span className="port-label">pal</span>
      </div>
      <div className="port port-out gen-out" data-port="output" title="Generated images" />
    </div>
  )
}

export function NodeView({ node, selected }: { node: CanvasNode; selected: boolean }) {
  return node.kind === 'image' ? (
    <ImageNodeView node={node} selected={selected} />
  ) : (
    <GenNodeView node={node} selected={selected} />
  )
}
