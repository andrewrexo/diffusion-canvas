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

export const IconEraser = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M5.5 12.5 L1.8 8.8 A1 1 0 0 1 1.8 7.4 L7.4 1.8 A1 1 0 0 1 8.8 1.8 L13.2 6.2 A1 1 0 0 1 13.2 7.6 L8.3 12.5 Z" />
    <path d="M4.5 5 L10 10.5" />
    <path d="M8.3 12.5 H13.5" />
  </svg>
)

export const IconBucket = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M7 1.5 L13 7.5 L7.5 13 L2 7.5 L7 2.5" />
    <path d="M2 7.5 H12.9" />
    <path d="M13.2 10.5 Q14.2 12 13.2 12.8 Q12.2 12 13.2 10.5 Z" />
  </svg>
)

export const IconLine = () => (
  <svg {...base}>
    <path d="M3.2 11.8 L11.8 3.2" />
    <rect x="1.5" y="10.5" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="10.5" y="1.5" width="3" height="3" fill="currentColor" stroke="none" />
  </svg>
)

export const IconRect = () => (
  <svg {...base}>
    <rect x="2.5" y="3.5" width="10" height="8" />
  </svg>
)

export const IconPicker = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M8.6 4.4 L10.6 6.4 L4.6 12.4 L2 13 L2.6 10.4 Z" />
    <path d="M8 3 L10 1.5 L13.5 5 L12 7 Z" fill="currentColor" stroke="none" />
  </svg>
)

export const IconUndo = () => (
  <svg {...base} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 3 L1.8 6 L4.5 9" />
    <path d="M2 6 H9 A4 4 0 0 1 9 13.5 H5.5" />
  </svg>
)

export const IconRedo = () => (
  <svg {...base} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 3 L13.2 6 L10.5 9" />
    <path d="M13 6 H6 A4 4 0 0 0 6 13.5 H9.5" />
  </svg>
)

export const IconBack = () => (
  <svg {...base} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2.5 L4.5 7.5 L9.5 12.5" />
  </svg>
)
