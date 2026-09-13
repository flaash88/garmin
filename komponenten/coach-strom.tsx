'use client'

import { useRef, useState } from 'react'

/**
 * Antwortstrom des Coach. Jeder Werkzeugaufruf erscheint als einklappbare
 * Zeile — Beschriftung und Detailzeile wie im Entwurf:
 *
 *     Aktivitäten der letzten 8 Wochen geladen · 31 Einheiten · 218,4 km
 *
 * Phase 5 hängt das Agent SDK dahinter. Der Strom selbst ist hier fertig.
 */

export interface Werkzeugzeile {
  id: string
  beschriftung: string
  detail: string | null
  laeuft: boolean
}

interface Nachricht {
  rolle: 'du' | 'coach'
  text: string
  zeit: string
  werkzeuge: Werkzeugzeile[]
  fehler: string | null
}

function Werkzeug({ z }: { z: Werkzeugzeile }) {
  const [offen, setOffen] = useState(false)
  return (
    <div className="border border-kontur bg-flaeche-2">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left"
      >
        <span
          className={`size-1.5 flex-none rounded-full ${z.laeuft ? 'animate-pulse bg-warnung' : 'bg-positiv'}`}
        />
        <span className="marke flex-1 truncate text-[9.5px] text-text-leise">
          {z.beschriftung}
        </span>
        <span aria-hidden className="font-mono text-[10px] text-text-schwach">
          {offen ? '−' : '+'}
        </span>
      </button>
      {offen && z.detail ? (
        <div className="border-t border-kontur px-3 py-2 font-mono text-[11px] text-text-schwach">
          {z.detail}
        </div>
      ) : null}
    </div>
  )
}

export function CoachStrom() {
  const [verlauf, setVerlauf] = useState<Nachricht[]>([])
  const [eingabe, setEingabe] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const abbruch = useRef<AbortController | null>(null)

  function jetzt(): string {
    const d = new Date()
    const zz = (n: number) => String(n).padStart(2, '0')
    return `${zz(d.getHours())}:${zz(d.getMinutes())}`
  }

  async function senden(frage: string) {
    if (frage.trim().length === 0 || laeuft) return

    setVerlauf((v) => [
      ...v,
      { rolle: 'du', text: frage, zeit: jetzt(), werkzeuge: [], fehler: null },
      { rolle: 'coach', text: '', zeit: jetzt(), werkzeuge: [], fehler: null },
    ])
    setEingabe('')
    setLaeuft(true)

    abbruch.current = new AbortController()

    try {
      const antwort = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frage }),
        signal: abbruch.current.signal,
      })

      if (!antwort.ok || !antwort.body) {
        // Die Begründung steht in der Antwort. Sie hier durch eine feste
        // Meldung zu ersetzen hiesse, jemandem mit gesetztem Schlüssel zu
        // sagen, der Schlüssel fehle.
        let grund: string | null = null
        try {
          const koerper = (await antwort.json()) as { fehler?: unknown }
          if (typeof koerper.fehler === 'string') grund = koerper.fehler
        } catch {
          /* Kein brauchbarer Körper — dann bleibt es beim Statuscode. */
        }
        throw new Error(grund ?? `Der Coach antwortet nicht (${antwort.status}).`)
      }

      const leser = antwort.body.getReader()
      const entschluessler = new TextDecoder()
      let rest = ''

      for (;;) {
        const { done, value } = await leser.read()
        if (done) break
        rest += entschluessler.decode(value, { stream: true })

        const teile = rest.split('\n\n')
        rest = teile.pop() ?? ''

        for (const teil of teile) {
          const zeile = teil.split('\n').find((z) => z.startsWith('data: '))
          if (!zeile) continue
          let ereignis: unknown
          try {
            ereignis = JSON.parse(zeile.slice(6))
          } catch {
            continue
          }
          verarbeiten(ereignis)
        }
      }
    } catch (fehler) {
      if (fehler instanceof DOMException && fehler.name === 'AbortError') return
      const text = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler'
      setVerlauf((v) => {
        const neu = [...v]
        const letzte = neu.at(-1)
        if (letzte) neu[neu.length - 1] = { ...letzte, fehler: text }
        return neu
      })
    } finally {
      setLaeuft(false)
    }
  }

  function verarbeiten(ereignis: unknown) {
    if (typeof ereignis !== 'object' || ereignis === null) return
    const e = ereignis as Record<string, unknown>

    setVerlauf((v) => {
      const neu = [...v]
      const letzte = neu.at(-1)
      if (!letzte) return v

      if (e['art'] === 'text' && typeof e['text'] === 'string') {
        neu[neu.length - 1] = { ...letzte, text: letzte.text + e['text'] }
      } else if (e['art'] === 'werkzeug' && typeof e['id'] === 'string') {
        const vorhanden = letzte.werkzeuge.find((w) => w.id === e['id'])
        const zeile: Werkzeugzeile = {
          id: e['id'],
          beschriftung: typeof e['beschriftung'] === 'string' ? e['beschriftung'] : 'Werkzeug',
          detail: typeof e['detail'] === 'string' ? e['detail'] : null,
          laeuft: e['laeuft'] === true,
        }
        neu[neu.length - 1] = {
          ...letzte,
          werkzeuge: vorhanden
            ? letzte.werkzeuge.map((w) => (w.id === zeile.id ? zeile : w))
            : [...letzte.werkzeuge, zeile],
        }
      }
      return neu
    })
  }

  const letzteFrage = [...verlauf].reverse().find((n) => n.rolle === 'du')?.text ?? ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
        {verlauf.length === 0 ? (
          <div className="border border-kontur bg-flaeche p-6">
            <p className="text-[13.5px] leading-relaxed text-text">
              Frag den Coach nach deinen Daten. Er liest Aktivitäten, Belastung,
              Erholung und Plan.
            </p>
            <p className="mt-2 font-mono text-[11px] text-text-schwach">
              Keine Daten verlassen den Server.
            </p>
          </div>
        ) : null}

        {verlauf.map((n, i) => (
          <article key={i} className={n.rolle === 'du' ? 'flex justify-end' : ''}>
            {n.rolle === 'du' ? (
              <div className="max-w-[80%] border border-kontur bg-flaeche-2 px-4 py-3">
                <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-text-stark">
                  {n.text}
                </p>
              </div>
            ) : (
              <div className="max-w-[min(100%,68ch)]">
                <div className="flex items-baseline gap-2">
                  <span className="marke text-[9.5px] text-text-schwach">Coach</span>
                  <span className="font-mono text-[10px] text-text-schwach">{n.zeit}</span>
                </div>

                {n.werkzeuge.length > 0 ? (
                  <div className="mt-2 space-y-px">
                    {n.werkzeuge.map((w) => (
                      <Werkzeug key={w.id} z={w} />
                    ))}
                  </div>
                ) : null}

                {n.text.length === 0 && n.fehler === null && laeuft && i === verlauf.length - 1 ? (
                  <p className="mt-3 font-mono text-[11.5px] text-text-schwach">
                    Der Coach sieht sich deine Daten an …
                  </p>
                ) : null}

                {n.text.length > 0 ? (
                  <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line text-text">
                    {n.text}
                    {laeuft && i === verlauf.length - 1 ? (
                      <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse bg-akzent align-text-bottom" />
                    ) : null}
                  </p>
                ) : null}

                {n.fehler ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3" role="alert">
                    <span className="text-[12.5px] text-negativ">{n.fehler}</span>
                    <button
                      type="button"
                      onClick={() => void senden(letzteFrage)}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] border border-kontur px-3 text-[12.5px] text-text"
                    >
                      Erneut
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </article>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void senden(eingabe)
        }}
        className="flex-none border-t border-kontur bg-flaeche p-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void senden(eingabe)
              }
            }}
            rows={1}
            placeholder="Frage an den Coach"
            aria-label="Frage an den Coach"
            className="max-h-40 min-h-11 flex-1 resize-y rounded-[2px] border border-kontur-stark bg-grund px-3 py-2.5 text-[13.5px] text-text-stark outline-none focus:border-akzent"
          />
          <button
            type="submit"
            disabled={laeuft || eingabe.trim().length === 0}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] bg-text-stark px-4 text-[14px] font-medium text-grund disabled:cursor-not-allowed disabled:opacity-50"
          >
            Senden
          </button>
        </div>
      </form>
    </div>
  )
}
