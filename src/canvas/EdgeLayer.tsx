import type { Vec } from '../types'
import { inputAnchor, outputAnchor } from '../types'
import { useStore } from '../store'
import type { PendingEdge } from './connect'

function edgePath(a: Vec, b: Vec) {
  const bend = clampBend(Math.abs(b.x - a.x) * 0.5)
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`
}

const clampBend = (v: number) => Math.min(90, Math.max(28, v))

export function EdgeLayer({ pending }: { pending: PendingEdge | null }) {
  const doc = useStore((s) => s.doc)
  const zoom = useStore((s) => s.viewport.zoom)
  const width = 1.5 / zoom

  let pendingPath: string | null = null
  if (pending) {
    const node = doc.nodes[pending.nodeId]
    if (node) {
      pendingPath =
        pending.kind === 'from-output'
          ? edgePath(outputAnchor(node), pending.cursor)
          : edgePath(pending.cursor, inputAnchor(node, pending.port))
    }
  }

  return (
    <svg className="edge-layer">
      {doc.edges.map((e) => {
        const from = doc.nodes[e.from]
        const to = doc.nodes[e.to]
        if (!from || !to) return null
        const d =
          e.port === 'output'
            ? edgePath(outputAnchor(from), { x: to.x, y: to.y + 11 })
            : edgePath(outputAnchor(from), inputAnchor(to, e.port))
        return (
          <path
            key={e.id}
            d={d}
            className={e.port === 'output' ? 'edge edge-output' : 'edge'}
            strokeWidth={width}
          />
        )
      })}
      {pendingPath && <path d={pendingPath} className="edge edge-pending" strokeWidth={width} />}
    </svg>
  )
}
