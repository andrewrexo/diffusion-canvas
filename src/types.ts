export interface Vec {
  x: number
  y: number
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type NodeSource = 'import' | 'generated' | 'drawing'

export interface ImageNode {
  id: string
  kind: 'image'
  x: number
  y: number
  w: number
  h: number
  scale: number
  name: string
  frames: string[]
  fps: number
  source: NodeSource
}

export interface GenNode {
  id: string
  kind: 'gen'
  x: number
  y: number
  name: string
  prompt: string
  style: string
  width: number
  height: number
  seed: number | null
  strength: number
  status: 'idle' | 'running' | 'error'
  error?: string
}

export type CanvasNode = ImageNode | GenNode

export type InputPort = 'source' | 'palette'

export interface Edge {
  id: string
  from: string
  to: string
  port: InputPort | 'output'
}

export interface Doc {
  nodes: Record<string, CanvasNode>
  edges: Edge[]
}

export const HEAD_H = 22
export const GEN_W = 244
export const GEN_H = 232
export const GEN_PORT_Y: Record<InputPort, number> = { source: 46, palette: 74 }

export function nodeBounds(n: CanvasNode) {
  if (n.kind === 'gen') return { x: n.x, y: n.y, w: GEN_W, h: GEN_H }
  return { x: n.x, y: n.y, w: n.w * n.scale + 2, h: n.h * n.scale + HEAD_H + 2 }
}

export function outputAnchor(n: CanvasNode): Vec {
  const b = nodeBounds(n)
  if (n.kind === 'gen') return { x: n.x + GEN_W, y: n.y + GEN_PORT_Y.source }
  return { x: b.x + b.w, y: b.y + b.h / 2 }
}

export function inputAnchor(n: CanvasNode, port: InputPort): Vec {
  return { x: n.x, y: n.y + GEN_PORT_Y[port] }
}
