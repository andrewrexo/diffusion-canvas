import { useState } from 'react'
import type { CanvasNode, ImageNode } from '../types'
import { useStore } from '../store'

function NodeName({ node }: { node: CanvasNode }) {
  const renameNode = useStore((s) => s.renameNode)
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <span className="node-name" onDoubleClick={() => setDraft(node.name)}>
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

function ImageNodeView({ node, selected }: { node: ImageNode; selected: boolean }) {
  const w = node.w * node.scale
  const h = node.h * node.scale
  return (
    <div
      className={`node image-node${selected ? ' selected' : ''}`}
      data-node-id={node.id}
      style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: w + 2 }}
    >
      <div className="node-head">
        <NodeName node={node} />
        <span className="node-dims">
          {node.w}×{node.h}
        </span>
      </div>
      <div className="node-body checker">
        <img src={node.data} width={w} height={h} draggable={false} alt={node.name} />
      </div>
    </div>
  )
}

export function NodeView({ node, selected }: { node: CanvasNode; selected: boolean }) {
  return <ImageNodeView node={node} selected={selected} />
}
