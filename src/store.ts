import { create } from 'zustand'

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface AppState {
  viewport: Viewport
  panBy: (dx: number, dy: number) => void
  zoomAt: (cx: number, cy: number, factor: number) => void
}

export const useStore = create<AppState>()((set) => ({
  viewport: { x: 0, y: 0, zoom: 1 },

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
}))
