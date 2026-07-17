export interface Vec {
  x: number
  y: number
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
  data: string
  source: NodeSource
}

export type CanvasNode = ImageNode

export interface Doc {
  nodes: Record<string, CanvasNode>
}

export const HEAD_H = 22

export function nodeBounds(n: CanvasNode) {
  return { x: n.x, y: n.y, w: n.w * n.scale + 2, h: n.h * n.scale + HEAD_H + 2 }
}
