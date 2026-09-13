'use client'

import { useCallback, useEffect, useState } from 'react'
import { CoachStrom } from './coach-strom'
import { Zeitmarke } from './zeitmarke'

/**
 * Coach-Seite: Fadenliste links, Antwortstrom rechts — wie im Entwurf (1f).
 *
 * Die Liste kommt aus der Datenbank. Der erste Bestand wird auf dem Server
 * gerendert, damit beim Aufruf nichts nachspringt; danach hält diese
 * Komponente sie aktuell.
 */

export interface Fadeneintrag {
  id: string
  titel: string
  zuletztAm: string
}

function Eintrag({
  eintrag,
  offen,
  beiWahl,
  beiLoeschen,
}: {
  eintrag: Fadeneintrag
  offen: boolean
  beiWahl: () => void
  beiLoeschen: () => void
}) {
  const [fragt, setFragt] = useState(false)

  return (
    <div
      className={`border-b border-kontur border-l-2 ${
        offen ? 'border-l-akzent bg-akzent-flaeche' : 'border-l-transparent'
      }`}
    >
      <div className="flex items-start">
        <button
          type="button"
          onClick={beiWahl}
          aria-current={offen ? 'true' : undefined}
          className="min-w-0 flex-1 cursor-pointer px-[18px] py-[13px] text-left"
        >
          <span
            className={`block truncate text-[13px] leading-[1.4] ${
              offen ? 'font-medium text-text-stark' : 'text-text'
            }`}
          >
            {eintrag.titel}
          </span>
          <span className="mt-1.5 block font-mono text-[10.5px] text-text-schwach">
            <Zeitmarke iso={eintrag.zuletztAm} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFragt((f) => !f)}
          aria-label={`Unterhaltung «${eintrag.titel}» löschen`}
          aria-expanded={fragt}
          className="flex min-h-11 w-9 flex-none cursor-pointer items-center justify-center font-mono text-[13px] text-text-schwach hover:text-text"
        >
          ×
        </button>
      </div>
      {fragt ? (
        <div className="flex items-center gap-3 px-[18px] pb-3">
          <span className="font-mono text-[10.5px] text-text-schwach">
            Faden löschen?
          </span>
          <button
            type="button"
            onClick={beiLoeschen}
            className="cursor-pointer font-mono text-[10.5px] text-negativ underline underline-offset-2"
          >
            Ja, löschen
          </button>
          <button
            type="button"
            onClick={() => setFragt(false)}
            className="cursor-pointer font-mono text-[10.5px] text-text-leise underline underline-offset-2"
          >
            Abbrechen
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function CoachAnsicht({ anfangsliste }: { anfangsliste: Fadeneintrag[] }) {
  const [liste, setListe] = useState<Fadeneintrag[]>(anfangsliste)
  const [aktiv, setAktiv] = useState<string | null>(null)
  // Zählt jedes «Neu» mit — siehe CoachStrom.
  const [ruecksetzung, setRuecksetzung] = useState(0)
  // Auf dem Telefon steht die Liste hinter dem Kopf, nicht daneben (Entwurf 1g).
  const [listeOffen, setListeOffen] = useState(false)

  const listeLaden = useCallback(async () => {
    try {
      const antwort = await fetch('/api/coach/unterhaltungen')
      if (!antwort.ok) return
      const koerper = (await antwort.json()) as { unterhaltungen?: unknown }
      if (!Array.isArray(koerper.unterhaltungen)) return
      setListe(
        koerper.unterhaltungen.filter(
          (u: unknown): u is Fadeneintrag =>
            typeof u === 'object' &&
            u !== null &&
            typeof (u as Fadeneintrag).id === 'string' &&
            typeof (u as Fadeneintrag).titel === 'string' &&
            typeof (u as Fadeneintrag).zuletztAm === 'string',
        ),
      )
    } catch {
      // Die Liste bleibt, wie sie war. Ein fehlgeschlagener Abgleich der
      // Seitenspalte darf das Gespräch nicht stören.
    }
  }, [])

  useEffect(() => {
    setListeOffen(false)
  }, [aktiv])

  async function loeschen(id: string) {
    try {
      await fetch(`/api/coach/unterhaltungen/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    } catch {
      /* Auch dann neu laden — dann steht der Faden eben noch da. */
    }
    if (aktiv === id) setAktiv(null)
    await listeLaden()
  }

  const seitenspalte = (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-none items-center justify-between border-b border-kontur px-[18px] py-3">
        <span className="marke text-[10px] text-text-schwach">Verlauf</span>
        <button
          type="button"
          onClick={() => {
            setAktiv(null)
            setRuecksetzung((r) => r + 1)
          }}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[12.5px] text-text-leise hover:text-text-stark"
        >
          <span aria-hidden className="text-[15px] leading-none">
            +
          </span>
          Neu
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {liste.length === 0 ? (
          <p className="px-[18px] py-4 font-mono text-[11px] leading-relaxed text-text-schwach">
            Noch keine Unterhaltung. Die erste Frage beginnt einen Faden.
          </p>
        ) : (
          liste.map((e) => (
            <Eintrag
              key={e.id}
              eintrag={e}
              offen={e.id === aktiv}
              beiWahl={() => setAktiv(e.id)}
              beiLoeschen={() => void loeschen(e.id)}
            />
          ))
        )}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[250px_1fr]">
      <div className="flex-none border-b border-kontur bg-flaeche md:hidden">
        <button
          type="button"
          onClick={() => setListeOffen((o) => !o)}
          aria-expanded={listeOffen}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between px-5 py-2"
        >
          <span className="marke text-[10px] text-text-schwach">
            Verlauf · {liste.length}
          </span>
          <span aria-hidden className="font-mono text-[11px] text-text-schwach">
            {listeOffen ? '−' : '+'}
          </span>
        </button>
        {listeOffen ? (
          <div className="max-h-[50dvh] overflow-y-auto border-t border-kontur">
            {seitenspalte}
          </div>
        ) : null}
      </div>

      <aside className="hidden min-h-0 border-r border-kontur bg-flaeche md:flex md:flex-col">
        {seitenspalte}
      </aside>

      <CoachStrom
        unterhaltungId={aktiv}
        ruecksetzung={ruecksetzung}
        beiFaden={(id) => {
          setAktiv(id)
          void listeLaden()
        }}
        beiAenderung={() => void listeLaden()}
      />
    </div>
  )
}
