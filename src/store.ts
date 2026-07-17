import { create } from 'zustand'
import type { CanvasNode, Doc, Vec } from './types'
import { clamp, uid } from './lib/util'

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

const HISTORY_LIMIT = 64

const snapshot = (doc: Doc): Doc => ({ nodes: { ...doc.nodes } })

interface AppState {
  viewport: Viewport
  doc: Doc
  selection: string[]
  past: Doc[]
  future: Doc[]

  panBy: (dx: number, dy: number) => void
  zoomAt: (cx: number, cy: number, factor: number) => void
  setViewport: (viewport: Viewport) => void

  checkpoint: () => void
  undo: () => void
  redo: () => void

  setSelection: (ids: string[]) => void
  addNodes: (nodes: CanvasNode[]) => void
  setNodePositions: (positions: Record<string, Vec>) => void
  renameNode: (id: string, name: string) => void
  deleteSelection: () => void
  duplicateSelection: () => void
}

export const useStore = create<AppState>()((set, get) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  doc: { nodes: {} },
  selection: [],
  past: [],
  future: [],

  panBy: (dx, dy) =>
    set((s) => ({
      viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy },
    })),

  zoomAt: (cx, cy, factor) =>
    set((s) => {
      const zoom = clamp(s.viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const k = zoom / s.viewport.zoom
      return {
        viewport: {
          zoom,
          x: cx - (cx - s.viewport.x) * k,
          y: cy - (cy - s.viewport.y) * k,
        },
      }
    }),

  setViewport: (viewport) => set({ viewport }),

  checkpoint: () =>
    set((s) => ({
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snapshot(s.doc)],
      future: [],
    })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return s
      return {
        doc: prev,
        past: s.past.slice(0, -1),
        future: [snapshot(s.doc), ...s.future],
        selection: s.selection.filter((id) => prev.nodes[id]),
      }
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      return {
        doc: next,
        past: [...s.past, snapshot(s.doc)],
        future: s.future.slice(1),
        selection: s.selection.filter((id) => next.nodes[id]),
      }
    }),

  setSelection: (ids) => set({ selection: ids }),

  addNodes: (nodes) => {
    if (!nodes.length) return
    get().checkpoint()
    set((s) => {
      const merged = { ...s.doc.nodes }
      for (const n of nodes) merged[n.id] = n
      return { doc: { ...s.doc, nodes: merged }, selection: nodes.map((n) => n.id) }
    })
  },

  setNodePositions: (positions) =>
    set((s) => {
      const nodes = { ...s.doc.nodes }
      for (const [id, p] of Object.entries(positions)) {
        const n = nodes[id]
        if (n) nodes[id] = { ...n, x: Math.round(p.x), y: Math.round(p.y) }
      }
      return { doc: { ...s.doc, nodes } }
    }),

  renameNode: (id, name) => {
    const n = get().doc.nodes[id]
    if (!n || n.name === name) return
    get().checkpoint()
    set((s) => ({
      doc: { ...s.doc, nodes: { ...s.doc.nodes, [id]: { ...n, name } } },
    }))
  },

  deleteSelection: () => {
    const { selection } = get()
    if (!selection.length) return
    get().checkpoint()
    set((s) => {
      const nodes = { ...s.doc.nodes }
      for (const id of s.selection) delete nodes[id]
      return { doc: { ...s.doc, nodes }, selection: [] }
    })
  },

  duplicateSelection: () => {
    const { selection, doc } = get()
    if (!selection.length) return
    get().checkpoint()
    const clones = selection
      .map((id) => doc.nodes[id])
      .filter((n) => n !== undefined)
      .map((n) => ({ ...n, id: uid(), x: n.x + 16, y: n.y + 16 }))
    set((s) => {
      const nodes = { ...s.doc.nodes }
      for (const n of clones) nodes[n.id] = n
      return { doc: { ...s.doc, nodes }, selection: clones.map((n) => n.id) }
    })
  },
}))
