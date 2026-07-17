import { useEffect, useState } from 'react'
import { useStore } from '../store'

export function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen)
  return open ? <SettingsForm /> : null
}

function SettingsForm() {
  const setOpen = useStore((s) => s.setSettingsOpen)
  const setApiKey = useStore((s) => s.setApiKey)
  const [draft, setDraft] = useState(() => useStore.getState().apiKey)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const save = () => {
    setApiKey(draft.trim())
    setOpen(false)
  }

  return (
    <div
      className="overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="dialog">
        <h2>Settings</h2>
        <label className="field">
          <span>Retro Diffusion API key</span>
          <input
            type="password"
            placeholder="rdpk-…"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
        </label>
        <p className="field-hint">
          Create a key under Dev Tools at{' '}
          <a href="https://www.retrodiffusion.ai" target="_blank" rel="noreferrer">
            retrodiffusion.ai
          </a>
          . It never leaves this browser.
        </p>
        <div className="dialog-actions">
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm('Remove everything from the canvas?')) {
                useStore.getState().clearDoc()
                setOpen(false)
              }
            }}
          >
            Clear canvas
          </button>
          <div className="topbar-spacer" />
          <button className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
