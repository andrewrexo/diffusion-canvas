const base = {
  width: 15,
  height: 15,
  viewBox: '0 0 15 15',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  'aria-hidden': true,
} as const

export const IconSpark = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M7.5 1.5 L9 6 L13.5 7.5 L9 9 L7.5 13.5 L6 9 L1.5 7.5 L6 6 Z" />
  </svg>
)

export const IconImage = () => (
  <svg {...base}>
    <rect x="1.5" y="2.5" width="12" height="10" rx="1" />
    <circle cx="5" cy="6" r="1.1" />
    <path d="M1.5 11 L5.5 8 L8 10 L10.5 7.5 L13.5 10.5" strokeLinejoin="round" />
  </svg>
)

export const IconSliders = () => (
  <svg {...base} strokeLinecap="round">
    <path d="M1.5 4 H8 M11 4 H13.5" />
    <circle cx="9.5" cy="4" r="1.6" />
    <path d="M1.5 11 H4 M7 11 H13.5" />
    <circle cx="5.5" cy="11" r="1.6" />
  </svg>
)

export const IconDownload = () => (
  <svg {...base} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.5 2 V9.5 M4.5 7 L7.5 10 L10.5 7" />
    <path d="M2 12.5 H13" />
  </svg>
)

export const IconPencil = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M2 13 L2.7 10 L10.5 2.2 A1 1 0 0 1 12 2.2 L12.8 3 A1 1 0 0 1 12.8 4.5 L5 12.3 L2 13 Z" />
  </svg>
)
