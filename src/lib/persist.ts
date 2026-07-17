import type { Doc, Viewport } from '../types'

const STORAGE_KEY = 'diffusion-canvas.project'

interface Stored {
  version: 1
  doc: Doc
  viewport: Viewport
}

export function loadStored(): { doc: Doc; viewport: Viewport } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    if (parsed.version !== 1 || typeof parsed.doc?.nodes !== 'object' || !Array.isArray(parsed.doc?.edges)) {
      return null
    }
    for (const n of Object.values(parsed.doc.nodes)) {
      if (n.kind === 'gen') {
        n.status = 'idle'
        delete n.error
      }
    }
    return { doc: parsed.doc, viewport: parsed.viewport ?? { x: 0, y: 0, zoom: 1 } }
  } catch {
    return null
  }
}

export function saveStored(doc: Doc, viewport: Viewport): boolean {
  try {
    const payload: Stored = { version: 1, doc, viewport }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
