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
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        Diffusion Canvas
      </div>
      <div className="topbar-spacer" />
    </header>
  )
}
