import type { Doc, ImageNode, Viewport } from '../types'

const STORAGE_KEY = 'diffusion-canvas.project'

interface Stored {
  version: 1 | 2
  doc: Doc
  viewport: Viewport
}

export function loadStored(): { doc: Doc; viewport: Viewport } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    if (parsed.version !== 1 && parsed.version !== 2) return null
    if (typeof parsed.doc?.nodes !== 'object' || !Array.isArray(parsed.doc?.edges)) return null
    for (const n of Object.values(parsed.doc.nodes)) {
      if (n.kind === 'gen') {
        n.status = 'idle'
        delete n.error
      } else {
        /* v1 stored a single `data` url per image node */
        const legacy = n as ImageNode & { data?: string }
        if (legacy.data !== undefined) {
          legacy.frames = [legacy.data]
          delete legacy.data
        }
        legacy.fps ??= 8
      }
    }
    return { doc: parsed.doc, viewport: parsed.viewport ?? { x: 0, y: 0, zoom: 1 } }
  } catch {
    return null
  }
}

export function saveStored(doc: Doc, viewport: Viewport): boolean {
  try {
    const payload: Stored = { version: 2, doc, viewport }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
