'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Markdown } from './markdown'
import { uhrzeit } from '@/lib/format'

/**
 * Antwortstrom des Coach. Jeder Werkzeugaufruf erscheint als einklappbare
 * Zeile — Beschriftung und Detailzeile wie im Entwurf:
 *
 *     Aktivitäten der letzten 8 Wochen geladen · 31 Einheiten · 218,4 km
 *
 * Der Verlauf liegt in der Datenbank, nicht im Zustand dieser Komponente:
 * beim Wiederöffnen eines Fadens wird er von dort geladen, samt der
 * Werkzeugzeilen von damals.
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
  /**
   * Abgelaufener oder fehlender Zugang. Eigener Zustand, weil er eine andere
   * Handlung verlangt als ein Netzausfall: nicht «Erneut», sondern einen
   * neuen Token.
   */
  zugang: string | null
}

interface AbgelegteNachricht {
  rolle?: unknown
  text?: unknown
  werkzeuge?: unknown
  zugang?: unknown
  fehler?: unknown
  erstelltAm?: unknown
}

function abgelegteLesen(roh: unknown): Nachricht[] {
  if (!Array.isArray(roh)) return []
  return roh.map((r: AbgelegteNachricht, i): Nachricht => {
    const werkzeuge = Array.isArray(r.werkzeuge) ? r.werkzeuge : []
    return {
      rolle: r.rolle === 'du' ? 'du' : 'coach',
      text: typeof r.text === 'string' ? r.text : '',
      zeit: typeof r.erstelltAm === 'string' ? uhrzeit(new Date(r.erstelltAm)) : '',
      werkzeuge: werkzeuge.map((w: { beschriftung?: unknown; detail?: unknown }, j) => ({
        id: `${i}-${j}`,
        beschriftung: typeof w.beschriftung === 'string' ? w.beschriftung : 'Werkzeug',
        detail: typeof w.detail === 'string' ? w.detail : null,
        // Was abgelegt ist, läuft nicht mehr.
        laeuft: false,
      })),
      zugang: typeof r.zugang === 'string' ? r.zugang : null,
      fehler: typeof r.fehler === 'string' ? r.fehler : null,
    }
  })
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

export function CoachStrom({
  unterhaltungId,
  ruecksetzung,
  beiFaden,
  beiAenderung,
}: {
  /** Der offene Faden, oder `null` für einen neuen. */
  unterhaltungId: string | null
  /**
   * Zählt hoch, wenn «Neu» gedrückt wurde.
   *
   * Ohne das bliebe ein gescheiterter erster Zug stehen: er hat noch keinen
   * Faden, `unterhaltungId` ist schon `null`, und ein zweites «Neu» änderte
   * nichts.
   */
  ruecksetzung: number
  /** Ein neuer Faden ist entstanden — die Liste daneben muss ihn kennen. */
  beiFaden: (id: string) => void
  /** Etwas wurde abgelegt: Titel oder Zeitstempel in der Liste sind veraltet. */
  beiAenderung: () => void
}) {
  const [verlauf, setVerlauf] = useState<Nachricht[]>([])
  const [eingabe, setEingabe] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [ladefehler, setLadefehler] = useState<string | null>(null)
  const abbruch = useRef<AbortController | null>(null)
  /**
   * Der Faden, dessen Inhalt gerade angezeigt wird. Ohne diese Merkung würde
   * der Wechsel auf einen soeben begonnenen Faden den laufenden Strom durch
   * ein Nachladen aus der Datenbank ersetzen — mitten in der Antwort.
   */
  const angezeigt = useRef<string | null>(null)
  const letzteRuecksetzung = useRef(ruecksetzung)
  const ende = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (angezeigt.current === unterhaltungId && letzteRuecksetzung.current === ruecksetzung) {
      return
    }
    angezeigt.current = unterhaltungId
    letzteRuecksetzung.current = ruecksetzung

    // Ein Wechsel während einer laufenden Antwort bricht sie ab. Abgelegt ist
    // sie trotzdem — der Server schreibt unabhängig vom Strom mit.
    abbruch.current?.abort()
    setLadefehler(null)

    if (unterhaltungId === null) {
      setVerlauf([])
      return
    }

    let verworfen = false
    setLaedt(true)
    void (async () => {
      try {
        const antwort = await fetch(
          `/api/coach/unterhaltungen/${encodeURIComponent(unterhaltungId)}`,
        )
        if (!antwort.ok) throw new Error('Der Faden lässt sich nicht öffnen.')
        const koerper = (await antwort.json()) as { nachrichten?: unknown }
        if (!verworfen) setVerlauf(abgelegteLesen(koerper.nachrichten))
      } catch (fehler) {
        if (!verworfen) {
          setVerlauf([])
          setLadefehler(
            fehler instanceof Error ? fehler.message : 'Der Faden lässt sich nicht öffnen.',
          )
        }
      } finally {
        if (!verworfen) setLaedt(false)
      }
    })()
    return () => {
      verworfen = true
    }
  }, [unterhaltungId, ruecksetzung])

  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'end' })
  }, [verlauf.length])

  const letzteErsetzen = useCallback((wie: (n: Nachricht) => Nachricht) => {
    setVerlauf((v) => {
      const letzte = v.at(-1)
      if (!letzte) return v
      const neu = [...v]
      neu[neu.length - 1] = wie(letzte)
      return neu
    })
  }, [])

  function jetzt(): string {
    return uhrzeit(new Date())
  }

  async function senden(frage: string) {
    if (frage.trim().length === 0 || laeuft) return

    setVerlauf((v) => [
      ...v,
      { rolle: 'du', text: frage, zeit: jetzt(), werkzeuge: [], fehler: null, zugang: null },
      { rolle: 'coach', text: '', zeit: jetzt(), werkzeuge: [], fehler: null, zugang: null },
    ])
    setEingabe('')
    setLaeuft(true)
    setLadefehler(null)

    abbruch.current = new AbortController()

    try {
      const antwort = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frage, unterhaltungId }),
        signal: abbruch.current.signal,
      })

      if (!antwort.ok || !antwort.body) {
        // Die Begründung steht in der Antwort. Sie hier durch eine feste
        // Meldung zu ersetzen hiesse, jemandem mit gesetztem Schlüssel zu
        // sagen, der Schlüssel fehle.
        let grund: string | null = null
        try {
          const koerper = (await antwort.json()) as { fehler?: unknown; unterhaltungId?: unknown }
          if (typeof koerper.fehler === 'string') grund = koerper.fehler
          if (typeof koerper.unterhaltungId === 'string') fadenUebernehmen(koerper.unterhaltungId)
        } catch {
          /* Kein brauchbarer Körper — dann bleibt es beim Statuscode. */
        }
        if (antwort.status === 503 || antwort.status === 401) {
          // Zugang fehlt oder ist abgelaufen — kein allgemeiner Fehler.
          letzteErsetzen((l) => ({
            ...l,
            zugang: grund ?? 'Zugang abgelaufen — Token neu erzeugen',
          }))
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
      letzteErsetzen((l) => ({ ...l, fehler: text }))
    } finally {
      setLaeuft(false)
      beiAenderung()
    }
  }

  /** Den Faden übernehmen, ohne dass der Nachladeeffekt den Strom überschreibt. */
  function fadenUebernehmen(id: string) {
    if (angezeigt.current === id) return
    angezeigt.current = id
    beiFaden(id)
  }

  function verarbeiten(ereignis: unknown) {
    if (typeof ereignis !== 'object' || ereignis === null) return
    const e = ereignis as Record<string, unknown>

    if (e['art'] === 'faden' && typeof e['id'] === 'string') {
      fadenUebernehmen(e['id'])
      return
    }

    setVerlauf((v) => {
      const neu = [...v]
      const letzte = neu.at(-1)
      if (!letzte) return v

      if (e['art'] === 'zugang') {
        neu[neu.length - 1] = {
          ...letzte,
          zugang: typeof e['text'] === 'string' ? e['text'] : 'Zugang abgelaufen',
        }
      } else if (e['art'] === 'fehler' && typeof e['text'] === 'string') {
        neu[neu.length - 1] = { ...letzte, fehler: e['text'] }
      } else if (e['art'] === 'text' && typeof e['text'] === 'string') {
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
        {laedt ? (
          <p className="font-mono text-[11.5px] text-text-schwach">Faden wird geladen …</p>
        ) : null}

        {ladefehler ? (
          <p className="text-[12.5px] text-negativ" role="alert">
            {ladefehler}
          </p>
        ) : null}

        {verlauf.length === 0 && !laedt && ladefehler === null ? (
          <div className="border border-kontur bg-flaeche p-6">
            <p className="text-[13.5px] leading-relaxed text-text">
              Frag den Coach nach deinen Daten. Er liest Aktivitäten, Belastung,
              Erholung und Plan.
            </p>
            <p className="mt-2 font-mono text-[11px] text-text-schwach">
              Läuft über dein Claude-Abo. Deine Laufdaten gehen mit der Frage an
              Anthropic, sonst nirgendwohin.
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

                {n.text.length === 0 &&
                n.fehler === null &&
                n.zugang === null &&
                laeuft &&
                i === verlauf.length - 1 ? (
                  <p className="mt-3 font-mono text-[11.5px] text-text-schwach">
                    Der Coach sieht sich deine Daten an …
                  </p>
                ) : null}

                {n.text.length === 0 &&
                n.fehler === null &&
                n.zugang === null &&
                !(laeuft && i === verlauf.length - 1) ? (
                  <p className="mt-3 font-mono text-[11.5px] text-text-schwach">
                    Abgebrochen — der Coach ist nicht zu einer Antwort gekommen.
                  </p>
                ) : null}

                {n.text.length > 0 ? (
                  <div className="mt-3">
                    <Markdown text={n.text} />
                    {laeuft && i === verlauf.length - 1 ? (
                      <span className="mt-1 inline-block h-[1.1em] w-[2px] animate-pulse bg-akzent align-text-bottom" />
                    ) : null}
                  </div>
                ) : null}

                {n.zugang ? (
                  <div
                    className="mt-3 border border-warnung bg-flaeche p-4"
                    role="alert"
                  >
                    <div className="flex items-center gap-[9px]">
                      <span className="size-1.5 flex-none rounded-full bg-warnung" />
                      <span className="marke text-[10px] text-warnung">
                        Zugang abgelaufen
                      </span>
                    </div>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-text">
                      {n.zugang}
                    </p>
                    <p className="mt-3 font-mono text-[11.5px] leading-relaxed text-text-schwach">
                      Neuen Token erzeugen und in{' '}
                      <code className="text-text-leise">.env</code> eintragen:
                      <br />
                      <code className="text-text-leise">claude setup-token</code>
                      <br />
                      Danach den Dienst neu starten. Alles außer dem Coach läuft
                      weiter.
                    </p>
                  </div>
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
        <div ref={ende} />
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
