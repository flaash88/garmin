'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Route } from 'next'
import {
  SymbolCoach,
  SymbolLaeufe,
  SymbolMehr,
  SymbolPlan,
  SymbolUebersicht,
} from './symbole'

interface Eintrag {
  pfad: Route
  name: string
}

/** Linke Leiste am Schreibtisch. Reihenfolge wie im Entwurf. */
const SEITENLEISTE: Eintrag[] = [
  { pfad: '/', name: 'Übersicht' },
  { pfad: '/aktivitaeten', name: 'Aktivitäten' },
  { pfad: '/erholung', name: 'Erholung' },
  { pfad: '/belastung', name: 'Belastung' },
  { pfad: '/plan', name: 'Plan' },
  { pfad: '/strecken', name: 'Strecken' },
  { pfad: '/coach', name: 'Coach' },
  { pfad: '/ausruestung', name: 'Ausrüstung' },
]

/** Untere Leiste am Telefon. Fünf Einträge, wie im Entwurf. */
const UNTERLEISTE: Array<Eintrag & { Symbol: () => React.JSX.Element }> = [
  { pfad: '/', name: 'Übersicht', Symbol: SymbolUebersicht },
  { pfad: '/aktivitaeten', name: 'Läufe', Symbol: SymbolLaeufe },
  { pfad: '/plan', name: 'Plan', Symbol: SymbolPlan },
  { pfad: '/coach', name: 'Coach', Symbol: SymbolCoach },
  { pfad: '/mehr', name: 'Mehr', Symbol: SymbolMehr },
]

function istHier(pfad: string, jetzt: string): boolean {
  if (pfad === '/') return jetzt === '/'
  return jetzt === pfad || jetzt.startsWith(`${pfad}/`)
}

/** Welcher Eintrag der Unterleiste gilt als aktiv, wenn die Seite nur dort hängt. */
const UNTER_MEHR = ['/erholung', '/belastung', '/strecken', '/ausruestung']

export function Seitenleiste() {
  const jetzt = usePathname()

  return (
    <nav className="flex flex-col gap-px px-3" aria-label="Hauptbereiche">
      {SEITENLEISTE.map(({ pfad, name }) => {
        const aktiv = istHier(pfad, jetzt)
        return (
          <Link
            key={pfad}
            href={pfad}
            aria-current={aktiv ? 'page' : undefined}
            className={
              aktiv
                ? 'border-l-2 border-akzent bg-akzent-flaeche px-3 py-[9px] text-sm font-medium text-akzent'
                : 'border-l-2 border-transparent px-3 py-[9px] text-sm text-text hover:text-text-stark'
            }
          >
            {name}
          </Link>
        )
      })}
    </nav>
  )
}

export function Unterleiste() {
  const jetzt = usePathname()

  return (
    <nav
      aria-label="Hauptbereiche"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-kontur bg-flaeche pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-5">
        {UNTERLEISTE.map(({ pfad, name, Symbol }) => {
          const aktiv =
            istHier(pfad, jetzt) ||
            (pfad === '/mehr' && UNTER_MEHR.some((p) => istHier(p, jetzt)))
          return (
            <Link
              key={pfad}
              href={pfad}
              aria-current={aktiv ? 'page' : undefined}
              // 50 px aus dem Entwurf, aber nie unter 44 px Berührungsziel.
              className={`flex h-[50px] min-h-11 flex-col items-center justify-center gap-[5px] ${
                aktiv ? 'text-akzent' : 'text-text-schwach'
              }`}
            >
              <Symbol />
              <span className="font-mono text-[9.5px] font-medium">{name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
