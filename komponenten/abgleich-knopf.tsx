'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SymbolAbgleich } from './symbole'

interface Ergebnis {
  fehler: string[]
  zahlen: Record<string, number> | null
}

/**
 * Stößt einen Abgleich an und zeigt, was dabei herauskam.
 *
 * Mehrfaches Klicken fängt der Knopf selbst ab (er sperrt sich, solange ein
 * Lauf offen ist) **und** die Route dahinter: ein zweiter Aufruf bekommt
 * denselben Lauf, statt einen zweiten zu starten. Der Knopf allein genügte
 * nicht — zwei Reiter nebeneinander wüssten nichts voneinander.
 */
export function AbgleichKnopf() {
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)
  const router = useRouter()

  async function anstossen() {
    if (laeuft) return
    setLaeuft(true)
    setErgebnis(null)

    try {
      const antwort = await fetch('/api/abgleich', { method: 'POST' })
      const daten = (await antwort.json()) as Ergebnis
      setErgebnis(daten)
      // Die Seite trägt jetzt alte Zahlen — neu holen.
      if (daten.fehler.length === 0) router.refresh()
    } catch (fehler) {
      setErgebnis({
        fehler: [fehler instanceof Error ? fehler.message : 'Netzfehler'],
        zahlen: null,
      })
    } finally {
      setLaeuft(false)
    }
  }

  const gescheitert = ergebnis !== null && ergebnis.fehler.length > 0
  const gelungen = ergebnis !== null && ergebnis.fehler.length === 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void anstossen()}
        disabled={laeuft}
        aria-label={laeuft ? 'Abgleich läuft' : 'Jetzt abgleichen'}
        title={laeuft ? 'Abgleich läuft' : 'Jetzt abgleichen'}
        className="flex size-[34px] min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[2px] border border-kontur bg-flaeche text-text-leise disabled:cursor-wait md:min-h-[34px] md:min-w-[34px] hover:border-kontur-stark hover:text-text-stark"
      >
        <SymbolAbgleich dreht={laeuft} />
      </button>

      {ergebnis ? (
        <div
          role="status"
          className={`absolute top-[42px] right-0 z-30 w-[280px] border bg-flaeche p-3 ${
            gescheitert ? 'border-negativ' : 'border-kontur'
          }`}
        >
          <div className="flex items-center gap-[9px]">
            <span
              className={`size-1.5 flex-none rounded-full ${
                gescheitert ? 'bg-negativ' : 'bg-positiv'
              }`}
            />
            <span className={`marke text-[9.5px] ${gescheitert ? 'text-negativ' : 'text-positiv'}`}>
              {gescheitert ? 'Abgleich unvollständig' : 'Abgleich fertig'}
            </span>
            <button
              type="button"
              onClick={() => setErgebnis(null)}
              aria-label="Meldung schließen"
              className="ml-auto cursor-pointer font-mono text-[12px] text-text-schwach hover:text-text"
            >
              ×
            </button>
          </div>

          {gelungen && ergebnis.zahlen ? (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-text-leise">
              {Object.entries(ergebnis.zahlen).map(([name, zahl]) => (
                <div key={name} className="flex justify-between gap-2">
                  <dt className="truncate capitalize">{name}</dt>
                  <dd className="text-text-stark">{zahl}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {gescheitert ? (
            <ul className="mt-2.5 space-y-1 font-mono text-[10.5px] leading-relaxed break-words text-text-leise">
              {ergebnis.fehler.slice(0, 3).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
