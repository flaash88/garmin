/** Symbole der unteren Leiste, wörtlich aus dem Entwurf übernommen. */

const gemeinsam = {
  width: 19,
  height: 19,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
} as const

export function SymbolUebersicht() {
  return (
    <svg {...gemeinsam} aria-hidden>
      <rect x="2.5" y="2.5" width="6" height="6" />
      <rect x="11.5" y="2.5" width="6" height="6" />
      <rect x="2.5" y="11.5" width="6" height="6" />
      <rect x="11.5" y="11.5" width="6" height="6" />
    </svg>
  )
}

export function SymbolLaeufe() {
  return (
    <svg {...gemeinsam} aria-hidden>
      <path d="M2.5 5h15M2.5 10h15M2.5 15h15" />
    </svg>
  )
}

export function SymbolPlan() {
  return (
    <svg {...gemeinsam} aria-hidden>
      <rect x="2.5" y="3.5" width="15" height="14" />
      <path d="M2.5 8h15M7 3.5v-2M13 3.5v-2" />
    </svg>
  )
}

export function SymbolCoach() {
  return (
    <svg {...gemeinsam} aria-hidden>
      <path d="M2.5 4.5h15v9h-9l-4 3.5V4.5Z" />
    </svg>
  )
}

export function SymbolMehr() {
  return (
    <svg {...gemeinsam} aria-hidden>
      <circle cx="4" cy="10" r="1.3" />
      <circle cx="10" cy="10" r="1.3" />
      <circle cx="16" cy="10" r="1.3" />
    </svg>
  )
}
