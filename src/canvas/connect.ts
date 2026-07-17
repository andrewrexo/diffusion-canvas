import type { InputPort, Vec } from '../types'

export type PendingEdge =
  | { kind: 'from-output'; nodeId: string; cursor: Vec }
  | { kind: 'from-input'; nodeId: string; port: InputPort; cursor: Vec }

export const isInputPort = (p: string | undefined): p is InputPort =>
  p === 'source' || p === 'palette'
