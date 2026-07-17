import { create } from 'zustand'
import type { CanvasNode, Doc, GenNode, ImageNode, InputPort, Vec, Viewport } from './types'
import { GEN_W, nodeBounds } from './types'
import { DEFAULT_STYLE } from './api/styles'
import { generate, getBalance, type Balance } from './api/retro'
import { displayScale } from './lib/image'
import { loadStored, saveStored } from './lib/persist'
import { clamp, uid } from './lib/util'

export type { Viewport } from './types'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

const HISTORY_LIMIT = 64
const API_KEY_STORAGE = 'diffusion-canvas.api-key'

const snapshot = (doc: Doc): Doc => ({ nodes: { ...doc.nodes }, edges: [...doc.edges] })

export interface Toast {
  id: string
  text: string
  kind: 'error' | 'info'
}

interface AppState {
  viewport: Viewport
  doc: Doc
  selection: string[]
  past: Doc[]
  future: Doc[]
  apiKey: string
  balance: Balance | null
  settingsOpen: boolean
  toasts: Toast[]
  editing: string | null

  panBy: (dx: number, dy: number) => void
  zoomAt: (cx: number, cy: number, factor: number) => void
  setViewport: (viewport: Viewport) => void

  checkpoint: () => void
  undo: () => void
  redo: () => void

  setSelection: (ids: string[]) => void
  addNodes: (nodes: CanvasNode[]) => void
  addGenNode: (at: Vec) => void
  updateGenNode: (id: string, patch: Partial<GenNode>) => void
  setNodePositions: (positions: Record<string, Vec>) => void
  renameNode: (id: string, name: string) => void
  deleteSelection: () => void
  duplicateSelection: () => void
  clearDoc: () => void

  connect: (from: string, to: string, port: InputPort) => void
  disconnect: (to: string, port: InputPort) => void
  runGenerator: (id: string) => Promise<void>

  openEditor: (id: string) => void
  closeEditor: () => void
  commitDrawing: (id: string, data: string) => void
  addDrawingNode: (at: Vec) => void

  setApiKey: (key: string) => void
  refreshBalance: () => Promise<void>
  setSettingsOpen: (open: boolean) => void
  toast: (text: string, kind?: Toast['kind']) => void
}

const stored = loadStored()

export const useStore = create<AppState>()((set, get) => ({
  viewport: stored?.viewport ?? { x: 0, y: 0, zoom: 1 },
  doc: stored?.doc ?? { nodes: {}, edges: [] },
  selection: [],
  past: [],
  future: [],
  apiKey: localStorage.getItem(API_KEY_STORAGE) ?? '',
  balance: null,
  settingsOpen: false,
  toasts: [],
  editing: null,

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

  addGenNode: (at) => {
    get().addNodes([
      {
        id: uid(),
        kind: 'gen',
        x: Math.round(at.x - GEN_W / 2),
        y: Math.round(at.y - 100),
        name: 'Generator',
        prompt: '',
        style: DEFAULT_STYLE,
        width: 128,
        height: 128,
        seed: null,
        strength: 0.8,
        status: 'idle',
      },
    ])
  },

  updateGenNode: (id, patch) =>
    set((s) => {
      const n = s.doc.nodes[id]
      if (!n || n.kind !== 'gen') return s
      return { doc: { ...s.doc, nodes: { ...s.doc.nodes, [id]: { ...n, ...patch } } } }
    }),

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
      const edges = s.doc.edges.filter((e) => nodes[e.from] && nodes[e.to])
      return { doc: { nodes, edges }, selection: [] }
    })
  },

  duplicateSelection: () => {
    const { selection, doc } = get()
    if (!selection.length) return
    get().checkpoint()
    const idMap: Record<string, string> = {}
    const clones = selection
      .map((id) => doc.nodes[id])
      .filter((n) => n !== undefined)
      .map((n) => {
        idMap[n.id] = uid()
        return { ...n, id: idMap[n.id], x: n.x + 16, y: n.y + 16 }
      })
    const clonedEdges = doc.edges
      .filter((e) => idMap[e.from] && idMap[e.to])
      .map((e) => ({ ...e, id: uid(), from: idMap[e.from], to: idMap[e.to] }))
    set((s) => {
      const nodes = { ...s.doc.nodes }
      for (const n of clones) nodes[n.id] = n
      return {
        doc: { nodes, edges: [...s.doc.edges, ...clonedEdges] },
        selection: clones.map((n) => n.id),
      }
    })
  },

  clearDoc: () => {
    if (!Object.keys(get().doc.nodes).length) return
    get().checkpoint()
    set({ doc: { nodes: {}, edges: [] }, selection: [], editing: null })
  },

  connect: (from, to, port) => {
    const { doc } = get()
    const a = doc.nodes[from]
    const b = doc.nodes[to]
    if (!a || a.kind !== 'image' || !b || b.kind !== 'gen' || from === to) return
    get().checkpoint()
    set((s) => ({
      doc: {
        ...s.doc,
        edges: [
          ...s.doc.edges.filter((e) => !(e.to === to && e.port === port)),
          { id: uid(), from, to, port },
        ],
      },
    }))
  },

  disconnect: (to, port) => {
    if (!get().doc.edges.some((e) => e.to === to && e.port === port)) return
    get().checkpoint()
    set((s) => ({
      doc: { ...s.doc, edges: s.doc.edges.filter((e) => !(e.to === to && e.port === port)) },
    }))
  },

  runGenerator: async (id) => {
    const s = get()
    const node = s.doc.nodes[id]
    if (!node || node.kind !== 'gen' || node.status === 'running') return
    if (!s.apiKey) {
      set({ settingsOpen: true })
      s.toast('Add your Retro Diffusion API key to generate', 'info')
      return
    }
    if (!node.prompt.trim()) {
      s.toast('Describe what to generate first', 'info')
      return
    }

    const input = (port: InputPort) => {
      const edge = s.doc.edges.find((e) => e.to === id && e.port === port)
      const src = edge && s.doc.nodes[edge.from]
      return src && src.kind === 'image' ? src.data.split(',')[1] : undefined
    }

    s.updateGenNode(id, { status: 'running', error: undefined })
    try {
      const result = await generate(s.apiKey, {
        prompt: node.prompt.trim(),
        style: node.style,
        width: node.width,
        height: node.height,
        seed: node.seed ?? undefined,
        inputImage: input('source'),
        strength: node.strength,
        inputPalette: input('palette'),
      })

      const gen = get().doc.nodes[id]
      const at = gen ? { x: gen.x, y: gen.y } : { x: node.x, y: node.y }
      const runs = get().doc.edges.filter((e) => e.from === id && e.port === 'output').length
      const scale = displayScale(node.width, node.height)
      const outputs: ImageNode[] = result.images.map((data, i) => ({
        id: uid(),
        kind: 'image',
        x: at.x + GEN_W + 64 + runs * 20,
        y: at.y + i * (node.height * scale + 40) + runs * 20,
        w: node.width,
        h: node.height,
        scale,
        name: node.prompt.trim().slice(0, 40),
        data,
        source: 'generated',
      }))

      get().checkpoint()
      set((st) => {
        const nodes = { ...st.doc.nodes }
        for (const n of outputs) nodes[n.id] = n
        const edges = [
          ...st.doc.edges,
          ...outputs.map((n) => ({ id: uid(), from: id, to: n.id, port: 'output' as const })),
        ]
        return { doc: { nodes, edges }, selection: outputs.map((n) => n.id) }
      })
      get().updateGenNode(id, { status: 'idle' })
      if (result.remainingBalance != null) {
        set((st) => ({ balance: { balance: result.remainingBalance!, credits: st.balance?.credits ?? 0 } }))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      get().updateGenNode(id, { status: 'error', error: message })
      get().toast(message)
    }
  },

  openEditor: (id) => {
    const n = get().doc.nodes[id]
    if (n?.kind === 'image') set({ editing: id, selection: [id] })
  },

  closeEditor: () => set({ editing: null }),

  commitDrawing: (id, data) => {
    const n = get().doc.nodes[id]
    if (!n || n.kind !== 'image') return
    get().checkpoint()
    set((s) => ({
      doc: { ...s.doc, nodes: { ...s.doc.nodes, [id]: { ...n, data } } },
    }))
  },

  addDrawingNode: (at) => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const scale = displayScale(size, size)
    const node: ImageNode = {
      id: uid(),
      kind: 'image',
      x: Math.round(at.x - (size * scale) / 2),
      y: Math.round(at.y - (size * scale) / 2),
      w: size,
      h: size,
      scale,
      name: 'Drawing',
      data: canvas.toDataURL('image/png'),
      source: 'drawing',
    }
    get().addNodes([node])
    set({ editing: node.id })
  },

  setApiKey: (key) => {
    localStorage.setItem(API_KEY_STORAGE, key)
    set({ apiKey: key, balance: null })
    if (key) void get().refreshBalance()
  },

  refreshBalance: async () => {
    const { apiKey, toast } = get()
    if (!apiKey) return
    try {
      set({ balance: await getBalance(apiKey) })
    } catch (err) {
      set({ balance: null })
      toast(err instanceof Error ? err.message : 'Could not reach Retro Diffusion')
    }
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  toast: (text, kind = 'error') => {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000)
  },
}))

let saveTimer: number | undefined
let warnedStorage = false

useStore.subscribe((s, prev) => {
  if (s.doc === prev.doc) return
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    if (saveStored(s.doc, useStore.getState().viewport)) {
      warnedStorage = false
    } else if (!warnedStorage) {
      warnedStorage = true
      useStore.getState().toast('Browser storage is full — recent changes may not persist')
    }
  }, 500)
})

window.addEventListener('beforeunload', () => {
  const s = useStore.getState()
  saveStored(s.doc, s.viewport)
})

export function centerOfCanvas(el: HTMLElement): Vec {
  const { x, y, zoom } = useStore.getState().viewport
  return { x: (el.clientWidth / 2 - x) / zoom, y: (el.clientHeight / 2 - y) / zoom }
}

export function contentBounds(doc: Doc) {
  const nodes = Object.values(doc.nodes)
  if (!nodes.length) return null
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
  return { minX, minY, maxX, maxY }
}
