// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store'
import type { GenNode, ImageNode } from './types'

const imageNode = (id: string): ImageNode => ({
  id,
  kind: 'image',
  x: 0,
  y: 0,
  w: 16,
  h: 16,
  scale: 4,
  name: id,
  frames: ['data:image/png;base64,'],
  fps: 8,
  source: 'import',
})

const genNode = (id: string): GenNode => ({
  id,
  kind: 'gen',
  x: 0,
  y: 0,
  name: 'Generator',
  prompt: '',
  style: 'rd_plus__default',
  width: 128,
  height: 128,
  seed: null,
  strength: 0.8,
  status: 'idle',
})

const state = () => useStore.getState()

beforeEach(() => {
  useStore.setState({
    doc: { nodes: {}, edges: [] },
    selection: [],
    past: [],
    future: [],
    editing: null,
    toasts: [],
  })
})

describe('history', () => {
  it('undoes and redoes node insertion', () => {
    state().addNodes([imageNode('a')])
    expect(Object.keys(state().doc.nodes)).toEqual(['a'])
    expect(state().selection).toEqual(['a'])

    state().undo()
    expect(state().doc.nodes).toEqual({})
    expect(state().selection).toEqual([])

    state().redo()
    expect(Object.keys(state().doc.nodes)).toEqual(['a'])
  })

  it('treats a drag as one step: positions restore on undo without new history per move', () => {
    state().addNodes([imageNode('a')])
    const before = state().past.length

    state().checkpoint()
    state().setNodePositions({ a: { x: 10.6, y: 20.2 } })
    state().setNodePositions({ a: { x: 40, y: 50 } })

    expect(state().doc.nodes.a).toMatchObject({ x: 40, y: 50 })
    expect(state().past.length).toBe(before + 1)

    state().undo()
    expect(state().doc.nodes.a).toMatchObject({ x: 0, y: 0 })
  })

  it('rounds positions to whole pixels', () => {
    state().addNodes([imageNode('a')])
    state().setNodePositions({ a: { x: 3.4, y: 7.5 } })
    expect(state().doc.nodes.a).toMatchObject({ x: 3, y: 8 })
  })

  it('clears the redo stack on new changes', () => {
    state().addNodes([imageNode('a')])
    state().undo()
    state().addNodes([imageNode('b')])
    expect(state().future).toEqual([])
  })
})

describe('graph edges', () => {
  it('connects an image to a generator input', () => {
    state().addNodes([imageNode('img'), genNode('gen')])
    state().connect('img', 'gen', 'source')
    expect(state().doc.edges).toMatchObject([{ from: 'img', to: 'gen', port: 'source' }])
  })

  it('replaces an existing edge on the same input port', () => {
    state().addNodes([imageNode('a'), imageNode('b'), genNode('gen')])
    state().connect('a', 'gen', 'source')
    state().connect('b', 'gen', 'source')
    expect(state().doc.edges).toMatchObject([{ from: 'b', to: 'gen', port: 'source' }])
  })

  it('allows source and palette edges to coexist', () => {
    state().addNodes([imageNode('a'), imageNode('b'), genNode('gen')])
    state().connect('a', 'gen', 'source')
    state().connect('b', 'gen', 'palette')
    expect(state().doc.edges).toHaveLength(2)
  })

  it('rejects invalid connections', () => {
    state().addNodes([imageNode('img'), genNode('g1'), genNode('g2')])
    state().connect('g1', 'g2', 'source')
    state().connect('img', 'img', 'source')
    state().connect('missing', 'g1', 'source')
    expect(state().doc.edges).toEqual([])
  })

  it('disconnect removes the edge and skips history when there is nothing to remove', () => {
    state().addNodes([imageNode('img'), genNode('gen')])
    state().connect('img', 'gen', 'source')
    const before = state().past.length

    state().disconnect('gen', 'palette')
    expect(state().past.length).toBe(before)

    state().disconnect('gen', 'source')
    expect(state().doc.edges).toEqual([])
  })

  it('deleting nodes removes their edges', () => {
    state().addNodes([imageNode('img'), genNode('gen')])
    state().connect('img', 'gen', 'source')
    state().setSelection(['img'])
    state().deleteSelection()
    expect(state().doc.nodes.gen).toBeDefined()
    expect(state().doc.edges).toEqual([])
  })
})

describe('duplicate and clear', () => {
  it('duplicates nodes with internal edges under fresh ids', () => {
    state().addNodes([imageNode('img'), genNode('gen')])
    state().connect('img', 'gen', 'source')
    state().setSelection(['img', 'gen'])
    state().duplicateSelection()

    const ids = Object.keys(state().doc.nodes)
    expect(ids).toHaveLength(4)
    expect(state().doc.edges).toHaveLength(2)

    const copies = state().selection
    expect(copies).toHaveLength(2)
    expect(copies).not.toContain('img')
    const copiedEdge = state().doc.edges.find((e) => copies.includes(e.from))
    expect(copiedEdge && copies.includes(copiedEdge.to)).toBe(true)
  })

  it('clearDoc empties the canvas and undo restores it', () => {
    state().addNodes([imageNode('img'), genNode('gen')])
    state().connect('img', 'gen', 'source')
    state().clearDoc()
    expect(state().doc.nodes).toEqual({})
    expect(state().doc.edges).toEqual([])

    state().undo()
    expect(Object.keys(state().doc.nodes)).toHaveLength(2)
    expect(state().doc.edges).toHaveLength(1)
  })
})

describe('toasts', () => {
  it('auto-dismisses after five seconds', () => {
    vi.useFakeTimers()
    state().toast('something happened')
    expect(state().toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(state().toasts).toEqual([])
    vi.useRealTimers()
  })
})
