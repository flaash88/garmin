'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Markdown } from './markdown'
import { zahl } from '@/lib/format'

/**
 * Einen Trainingsblock bestellen.
 *
 * Vier bis sechzehn Wochen, Vorgabe acht. Das Ziel kommt aus dem
 * Athletenprofil und lässt sich je Bestellung überschreiben — das Feld bleibt
 * leer und zeigt das hinterlegte Ziel als Platzhalter, damit sichtbar ist,
 * womit gerechnet wird, wenn man nichts einträgt.
 */

const MIN = 4
const MAX = 16

interface Zeile {
  id: string
  beschriftung: string
  detail: string | null
}

export function PlanBestellen({ zielImProfil }: { zielImProfil: string | null }) {
  const router = useRouter()
  const [wochen, setWochen] = useState(8)
  const [ziel, setZiel] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [offen, setOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [zugang, setZugang] = useState<string | null>(null)
  const abbruch = useRef<AbortController | null>(null)

  function verarbeiten(ereignis: unknown) {
    if (typeof ereignis !== 'object' || ereignis === null) return
    const e = ereignis as Record<string, unknown>

    if (e['art'] === 'text' && typeof e['text'] === 'string') {
      setText((t) => t + e['text'])
    } else if (e['art'] === 'fehler' && typeof e['text'] === 'string') {
      setFehler(e['text'])
    } else if (e['art'] === 'zugang') {
      setZugang(typeof e['text'] === 'string' ? e['text'] : 'Zugang abgelaufen')
    } else if (e['art'] === 'werkzeug' && typeof e['id'] === 'string') {
      const zeile: Zeile = {
        id: e['id'],
        beschriftung: typeof e['beschriftung'] === 'string' ? e['beschriftung'] : 'Werkzeug',
        detail: typeof e['detail'] === 'string' ? e['detail'] : null,
      }
      setZeilen((v) =>
        v.some((z) => z.id === zeile.id)
          ? v.map((z) => (z.id === zeile.id ? zeile : z))
          : [...v, zeile],
      )
    }
  }

  async function bestellen() {
    if (laeuft) return
    setLaeuft(true)
    setZeilen([])
    setText('')
    setFehler(null)
    setZugang(null)
    abbruch.current = new AbortController()

    try {
      const antwort = await fetch('/api/plan/vorschlag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wochen, ziel: ziel.trim() || null, hinweis: hinweis.trim() || null }),
        signal: abbruch.current.signal,
      })

      if (!antwort.ok || !antwort.body) {
        let grund: string | null = null
        try {
          const koerper = (await antwort.json()) as { fehler?: unknown }
          if (typeof koerper.fehler === 'string') grund = koerper.fehler
        } catch {
          /* Kein brauchbarer Körper. */
        }
        if (antwort.status === 503 || antwort.status === 401) {
          setZugang(grund ?? 'Zugang abgelaufen — Token neu erzeugen')
          return
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
          try {
            verarbeiten(JSON.parse(zeile.slice(6)))
          } catch {
            continue
          }
        }
      }
    } catch (ausnahme) {
      if (ausnahme instanceof DOMException && ausnahme.name === 'AbortError') return
      setFehler(ausnahme instanceof Error ? ausnahme.message : 'Unbekannter Fehler')
    } finally {
      setLaeuft(false)
      // Der Satz liegt in der Datenbank — die Seite holt ihn sich von dort.
      router.refresh()
    }
  }

  return (
    <div className="border border-kontur bg-flaeche">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between px-4 py-3.5 text-left md:px-5"
      >
        <span className="text-[14px] font-medium text-text-stark">Plan vorschlagen lassen</span>
        <span aria-hidden className="font-mono text-[11px] text-text-schwach">
          {offen ? '−' : '+'}
        </span>
      </button>

      {offen ? (
        <div className="border-t border-kontur p-4 md:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void bestellen()
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="wochen"
                className="marke block text-[9.5px] text-text-schwach"
              >
                Blocklänge · {zahl(wochen)} Wochen
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="wochen"
                  type="range"
                  min={MIN}
                  max={MAX}
                  step={1}
                  value={wochen}
                  onChange={(e) => setWochen(Number(e.target.value))}
                  className="h-11 flex-1 accent-akzent"
                />
                <input
                  type="number"
                  min={MIN}
                  max={MAX}
                  value={wochen}
                  aria-label="Blocklänge in Wochen"
                  onChange={(e) =>
                    setWochen(Math.min(MAX, Math.max(MIN, Number(e.target.value) || 8)))
                  }
                  className="min-h-11 w-20 rounded-[2px] border border-kontur-stark bg-grund px-3 text-center font-mono text-[13px] text-text-stark outline-none focus:border-akzent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ziel" className="marke block text-[9.5px] text-text-schwach">
                Ziel für diesen Block
              </label>
              <input
                id="ziel"
                value={ziel}
                onChange={(e) => setZiel(e.target.value)}
                placeholder={
                  zielImProfil
                    ? `Leer lassen: ${zielImProfil}`
                    : 'Kein Ziel im Profil hinterlegt'
                }
                className="mt-2 min-h-11 w-full rounded-[2px] border border-kontur-stark bg-grund px-3 text-[13.5px] text-text-stark outline-none focus:border-akzent"
              />
            </div>

            <div>
              <label htmlFor="hinweis" className="marke block text-[9.5px] text-text-schwach">
                Hinweise
              </label>
              <textarea
                id="hinweis"
                value={hinweis}
                onChange={(e) => setHinweis(e.target.value)}
                rows={2}
                placeholder="Etwa: dienstags geht nie, Sonntag ist der lange Lauf"
                className="mt-2 min-h-11 w-full resize-y rounded-[2px] border border-kontur-stark bg-grund px-3 py-2.5 text-[13.5px] text-text-stark outline-none focus:border-akzent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={laeuft}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] bg-text-stark px-4 text-[14px] font-medium text-grund disabled:cursor-not-allowed disabled:opacity-50"
              >
                {laeuft ? 'Der Coach stellt auf …' : 'Plan vorschlagen'}
              </button>
              {laeuft ? (
                <button
                  type="button"
                  onClick={() => abbruch.current?.abort()}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] border border-kontur px-3 text-[12.5px] text-text-leise"
                >
                  Abbrechen
                </button>
              ) : null}
              <span className="font-mono text-[10.5px] text-text-schwach">
                Nichts davon geht ohne deine Freigabe nach intervals.icu.
              </span>
            </div>
          </form>

          {zeilen.length > 0 ? (
            <div className="mt-4 space-y-px">
              {zeilen.map((z) => (
                <div key={z.id} className="border border-kontur bg-flaeche-2 px-3 py-2">
                  <div className="marke text-[9.5px] text-text-leise">{z.beschriftung}</div>
                  {z.detail ? (
                    <div className="mt-1 font-mono text-[10.5px] text-text-schwach">
                      {z.detail}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {text.length > 0 ? (
            <div className="mt-4">
              <Markdown text={text} />
            </div>
          ) : null}

          {zugang ? (
            <div className="mt-4 border border-warnung bg-flaeche p-4" role="alert">
              <span className="marke text-[10px] text-warnung">Zugang abgelaufen</span>
              <p className="mt-2 text-[13px] leading-relaxed text-text">{zugang}</p>
              <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-text-schwach">
                Neuen Token erzeugen (<code className="text-text-leise">claude setup-token</code>
                ), in <code className="text-text-leise">.env</code> eintragen, Dienst neu
                starten.
              </p>
            </div>
          ) : null}

          {fehler ? (
            <p className="mt-4 text-[12.5px] text-negativ" role="alert">
              {fehler}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
