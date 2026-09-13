'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { datum, strecke } from '@/lib/format'

interface Treffer {
  id: string
  name: string | null
  beginn: string
  streckeMeter: number | null
}

/**
 * Suche über Aktivitäten, Strecken und Notizen. Der Entwurf zeigt das Feld
 * mit ⌘K; ein Feld, das nichts tut, wäre schlechter als keines.
 */
export function Suche() {
  const [offen, setOffen] = useState(false)
  const [frage, setFrage] = useState('')
  const [treffer, setTreffer] = useState<Treffer[]>([])
  const [laeuft, setLaeuft] = useState(false)
  const feld = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOffen(true)
      }
      if (e.key === 'Escape') setOffen(false)
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])

  useEffect(() => {
    if (offen) feld.current?.focus()
  }, [offen])

  useEffect(() => {
    if (!offen || frage.trim().length < 2) {
      setTreffer([])
      return
    }
    const abbruch = new AbortController()
    const warten = setTimeout(() => {
      setLaeuft(true)
      fetch(`/api/suche?frage=${encodeURIComponent(frage)}`, { signal: abbruch.signal })
        .then((a) => (a.ok ? a.json() : { treffer: [] }))
        .then((d: { treffer?: Treffer[] }) => setTreffer(d.treffer ?? []))
        .catch(() => {
          /* Abgebrochen oder fehlgeschlagen — dann eben keine Treffer. */
        })
        .finally(() => setLaeuft(false))
    }, 200)
    return () => {
      clearTimeout(warten)
      abbruch.abort()
    }
  }, [frage, offen])

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="flex h-[34px] max-w-[420px] flex-1 cursor-pointer items-center gap-[9px] rounded-[2px] border border-kontur bg-grund px-[11px] text-left"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="flex-none text-text-schwach"
          aria-hidden
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <span className="flex-1 truncate text-[13px] text-text-schwach">
          Aktivitäten, Strecken, Notizen durchsuchen
        </span>
        <span className="rounded-[2px] border border-kontur px-[5px] py-0.5 font-mono text-[10.5px] text-text-schwach">
          ⌘K
        </span>
      </button>

      {offen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(0_0_0/0.4)] p-4 pt-[10vh]"
          onClick={() => setOffen(false)}
        >
          <div
            className="w-full max-w-[560px] border border-kontur bg-flaeche"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={feld}
              value={frage}
              onChange={(e) => setFrage(e.target.value)}
              placeholder="Aktivitäten, Strecken, Notizen durchsuchen"
              aria-label="Suchen"
              className="h-12 w-full border-b border-kontur bg-flaeche px-4 text-[14px] text-text-stark outline-none"
            />
            <div className="max-h-[50vh] overflow-y-auto">
              {laeuft ? (
                <div className="px-4 py-5 font-mono text-[11.5px] text-text-schwach">
                  Wird gesucht …
                </div>
              ) : treffer.length === 0 ? (
                <div className="px-4 py-5 font-mono text-[11.5px] text-text-schwach">
                  {frage.trim().length < 2 ? 'Mindestens zwei Zeichen.' : 'Nichts gefunden.'}
                </div>
              ) : (
                treffer.map((t) => (
                  <Link
                    key={t.id}
                    href={`/aktivitaeten/${t.id}`}
                    onClick={() => setOffen(false)}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-kontur px-4 py-3 last:border-b-0 hover:bg-flaeche-2"
                  >
                    <span className="truncate text-[13.5px] text-text-stark">
                      {t.name ?? 'Ohne Namen'}
                    </span>
                    <span className="flex-none font-mono text-[11.5px] text-text-schwach">
                      {datum(t.beginn)} · {t.streckeMeter === null ? '–' : strecke(t.streckeMeter)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
