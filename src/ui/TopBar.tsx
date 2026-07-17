import { useEffect } from 'react'
import { useStore } from '../store'
import { IconSliders } from './icons'

export function Logo() {
  return (
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true">
      <g fill="var(--accent)">
        <rect x="3" y="0" width="1" height="7" />
        <rect x="0" y="3" width="7" height="1" />
        <rect x="2" y="1" width="3" height="5" />
        <rect x="1" y="2" width="5" height="3" />
      </g>
      <g fill="#ffe3b3">
        <rect x="3" y="2" width="1" height="3" />
        <rect x="2" y="3" width="3" height="1" />
      </g>
    </svg>
  )
}

export function TopBar() {
  const apiKey = useStore((s) => s.apiKey)
  const balance = useStore((s) => s.balance)
  const refreshBalance = useStore((s) => s.refreshBalance)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)

  useEffect(() => {
    if (useStore.getState().apiKey) void useStore.getState().refreshBalance()
  }, [])

  const label = !apiKey
    ? 'Set API key'
    : balance === null
      ? '···'
      : balance.balance > 0
        ? `$${balance.balance.toFixed(2)}`
        : `${balance.credits} credits`

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        Diffusion Canvas
      </div>
      <div className="topbar-spacer" />
      <button
        className="chip"
        title={apiKey ? 'Retro Diffusion balance — click to refresh' : 'Open settings'}
        onClick={() => (apiKey ? void refreshBalance() : setSettingsOpen(true))}
      >
        {label}
      </button>
      <button className="iconbtn" title="Settings" onClick={() => setSettingsOpen(true)}>
        <IconSliders />
      </button>
    </header>
  )
}
