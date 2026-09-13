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

/** Sonne — wörtlich aus dem Entwurf, aus dem Knopf der Kopfzeile. */
export function SymbolSonne() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      aria-hidden
    >
      <circle cx="8" cy="8" r="3.4" />
      <path d="M8 .8v2M8 13.2v2M.8 8h2M13.2 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
    </svg>
  )
}

/**
 * Mond. Der Entwurf zeigt nur die Sonne; dieser ist im selben Maß gehalten —
 * 16er-Raster, Strichstärke 1,3, keine Füllung.
 */
export function SymbolMond() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.4 9.6A5.6 5.6 0 0 1 6.4 2.6a5.7 5.7 0 1 0 7 7Z" />
    </svg>
  )
}

/** Pfeil im Kreis — für «Jetzt abgleichen». */
export function SymbolAbgleich({ dreht = false }: { dreht?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      className={dreht ? 'animate-spin' : undefined}
      aria-hidden
    >
      <path d="M14 8a6 6 0 1 1-1.8-4.3" />
      <path d="M14 1.6v3.2h-3.2" />
    </svg>
  )
}
