'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Ziel } from '@/lib/daten/einstellungen'

/**
 * Das Ziel des Athleten. Steht dauerhaft im Profil und geht damit in **jede**
 * Antwort des Coach ein — auch ins Wochenbriefing, nicht nur in die Planung.
 * Je Planbestellung lässt es sich überschreiben.
 */
export function ZielFormular({ ziel: anfang }: { ziel: Ziel }) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [text, setText] = useState(anfang.text ?? '')
  const [tag, setTag] = useState(anfang.datum ?? '')
  const [zeit, setZeit] = useState(anfang.zeit ?? '')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  async function sichern() {
    setLaeuft(true)
    setMeldung(null)
    setFehler(null)
    try {
      const antwort = await fetch('/api/einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, datum: tag, zeit }),
      })
      const koerper = (await antwort.json()) as { fehler?: string }
      if (!antwort.ok) {
        setFehler(koerper.fehler ?? 'Das Ziel liess sich nicht sichern.')
        return
      }
      setMeldung('Gesichert. Der Coach kennt es ab der nächsten Frage.')
      router.refresh()
    } catch {
      setFehler('Das Ziel liess sich nicht sichern.')
    } finally {
      setLaeuft(false)
    }
  }

  const zusammenfassung = [anfang.text, anfang.zeit, anfang.datum]
    .filter((t): t is string => Boolean(t))
    .join(' · ')

  return (
    <div className="border border-kontur bg-flaeche">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left md:px-5"
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-text-stark">Ziel</span>
          <span className="mt-1 block truncate font-mono text-[10.5px] text-text-schwach">
            {zusammenfassung || 'nichts hinterlegt'}
          </span>
        </span>
        <span aria-hidden className="font-mono text-[11px] text-text-schwach">
          {offen ? '−' : '+'}
        </span>
      </button>

      {offen ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void sichern()
          }}
          className="space-y-4 border-t border-kontur p-4 md:p-5"
        >
          <div>
            <label htmlFor="ziel-text" className="marke block text-[9.5px] text-text-schwach">
              Wettkampf
            </label>
            <input
              id="ziel-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Halbmarathon, flach"
              className="mt-2 min-h-11 w-full rounded-[2px] border border-kontur-stark bg-grund px-3 text-[13.5px] text-text-stark outline-none focus:border-akzent"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ziel-datum"
                className="marke block text-[9.5px] text-text-schwach"
              >
                Datum
              </label>
              <input
                id="ziel-datum"
                type="date"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-[2px] border border-kontur-stark bg-grund px-3 font-mono text-[13px] text-text-stark outline-none focus:border-akzent"
              />
            </div>
            <div>
              <label
                htmlFor="ziel-zeit"
                className="marke block text-[9.5px] text-text-schwach"
              >
                Zielzeit
              </label>
              <input
                id="ziel-zeit"
                value={zeit}
                onChange={(e) => setZeit(e.target.value)}
                placeholder="1:35:00"
                className="mt-2 min-h-11 w-full rounded-[2px] border border-kontur-stark bg-grund px-3 font-mono text-[13px] text-text-stark outline-none focus:border-akzent"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={laeuft}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] bg-text-stark px-4 text-[13px] font-medium text-grund disabled:cursor-not-allowed disabled:opacity-50"
            >
              {laeuft ? 'Sichert …' : 'Sichern'}
            </button>
            {meldung ? (
              <span className="text-[12.5px] text-positiv" role="status">
                {meldung}
              </span>
            ) : null}
            {fehler ? (
              <span className="text-[12.5px] text-negativ" role="alert">
                {fehler}
              </span>
            ) : null}
          </div>

          <p className="font-mono text-[10.5px] leading-relaxed text-text-schwach">
            Das Ziel geht in jede Antwort des Coach ein, auch ins Wochenbriefing. Für eine
            einzelne Planbestellung lässt es sich dort überschreiben.
          </p>
        </form>
      ) : null}
    </div>
  )
}
