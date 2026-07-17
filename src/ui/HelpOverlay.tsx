import { useEffect, useState } from 'react'

const CANVAS_KEYS: [string, string][] = [
  ['G', 'Add generator'],
  ['Double-click canvas', 'Add generator there'],
  ['Double-click image', 'Edit pixels'],
  ['Drag from port', 'Connect nodes'],
  ['⌘ Enter', 'Generate (in prompt)'],
  ['Drop / paste', 'Import image'],
  ['⌘ Z / ⇧⌘ Z', 'Undo / redo'],
  ['⌘ D', 'Duplicate selection'],
  ['⌘ A', 'Select all'],
  ['Delete', 'Remove selection'],
  ['Space + drag', 'Pan'],
  ['⌘ scroll', 'Zoom'],
  ['⇧ 1', 'Fit view'],
]

const EDITOR_KEYS: [string, string][] = [
  ['B / E', 'Pencil / eraser'],
  ['G', 'Fill'],
  ['L / R', 'Line / rectangle'],
  ['I or ⌥ click', 'Pick color'],
  ['[ / ]', 'Brush size'],
  ['⌘ S', 'Save to canvas'],
  ['Esc', 'Back to canvas'],
]

export function HelpOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editable =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if (e.key === '?' && !editable) setOpen((v) => !v)
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button className="help-chip" title="Keyboard shortcuts (?)" onClick={() => setOpen(true)}>
        ?
      </button>
      {open && (
        <div
          className="overlay"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="dialog help-dialog">
            <h2>Shortcuts</h2>
            <div className="help-cols">
              <div>
                <div className="ed-section">Canvas</div>
                {CANVAS_KEYS.map(([k, label]) => (
                  <div className="help-row" key={k}>
                    <span className="key">{k}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="ed-section">Pixel editor</div>
                {EDITOR_KEYS.map(([k, label]) => (
                  <div className="help-row" key={k}>
                    <span className="key">{k}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
