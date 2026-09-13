'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { datum, dauer, strecke, zahl } from '@/lib/format'
import { kalenderwoche } from '@/lib/daten/zeit'
import { Zeitmarke } from './zeitmarke'
import type { Bestehende, EinheitAnsicht, SatzAnsicht } from './plan-typen'

/**
 * Plansätze prüfen und freigeben.
 *
 * Die Freigabe **überträgt sofort** nach intervals.icu. Was dabei schiefgeht,
 * steht an der Einheit — mit Grund und einem Knopf für den zweiten Versuch.
 * Es gibt keinen Nachlauf im Hintergrund: ein stiller zweiter Anlauf würde
 * den Fehlschlag verschleiern, und die Einheit stünde irgendwann ohne Zutun
 * im Kalender.
 */

const ZUSTANDSFARBE: Record<EinheitAnsicht['zustand'], string> = {
  vorschlag: 'bg-text-schwach',
  freigegeben: 'bg-negativ',
  uebertragen: 'bg-positiv',
  verworfen: 'bg-kontur-stark',
}

const ZUSTANDSWORT: Record<EinheitAnsicht['zustand'], string> = {
  vorschlag: 'Vorschlag',
  freigegeben: 'Freigegeben — Übertragung gescheitert',
  uebertragen: 'Übertragen',
  verworfen: 'Verworfen',
}

function Zustandsmarke({ zustand }: { zustand: EinheitAnsicht['zustand'] }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <span className={`size-1.5 flex-none rounded-full ${ZUSTANDSFARBE[zustand]}`} />
      <span className="marke text-[9.5px] text-text-schwach">{ZUSTANDSWORT[zustand]}</span>
    </span>
  )
}

function Kennzahlen({ e }: { e: EinheitAnsicht }) {
  const stuecke: string[] = []
  if (e.dauerSekunden) stuecke.push(dauer(e.dauerSekunden))
  if (e.streckeMeter) stuecke.push(strecke(e.streckeMeter))
  if (e.zielBelastung) stuecke.push(`Belastung ${zahl(e.zielBelastung)}`)
  if (stuecke.length === 0) return null
  return (
    <span className="font-mono text-[10.5px] text-text-schwach">{stuecke.join(' · ')}</span>
  )
}

function Einheit({
  e,
  bestehende,
  neuLaden,
}: {
  e: EinheitAnsicht
  bestehende: Bestehende
  /**
   * Den Stand neu vom Server holen. Die Zustände stehen in der Datenbank;
   * eine zweite Buchführung in der Oberfläche könnte davon abweichen — und
   * beim Zustand einer Einheit wäre das die falsche Stelle für einen
   * Irrtum.
   */
  neuLaden: () => void
}) {
  const [vorschauOffen, setVorschauOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fragtErsetzen, setFragtErsetzen] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const ersetzt = e.ersetztPlanId ? bestehende[e.ersetztPlanId] : undefined
  const offen = e.zustand === 'vorschlag' || e.zustand === 'freigegeben'

  async function freigeben(ersetzenBestaetigt: boolean) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch(`/api/plan/einheit/${encodeURIComponent(e.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ersetzenBestaetigt }),
      })
      const koerper = (await antwort.json()) as {
        geglueckt?: boolean
        fehler?: string | null
      }
      if (koerper.geglueckt !== true) {
        setMeldung(koerper.fehler ?? 'Die Übertragung ist gescheitert.')
      }
      neuLaden()
    } catch (fehler) {
      setMeldung(
        fehler instanceof Error
          ? `Die Übertragung ist gescheitert: ${fehler.message}`
          : 'Die Übertragung ist gescheitert.',
      )
    } finally {
      setLaeuft(false)
      setFragtErsetzen(false)
    }
  }

  async function verwerfen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch(`/api/plan/einheit/${encodeURIComponent(e.id)}`, {
        method: 'DELETE',
      })
      if (antwort.ok) neuLaden()
      else {
        const koerper = (await antwort.json()) as { fehler?: string }
        setMeldung(koerper.fehler ?? 'Verwerfen ist gescheitert.')
      }
    } catch {
      setMeldung('Verwerfen ist gescheitert.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div
      className={`border border-kontur bg-flaeche p-4 ${
        e.zustand === 'verworfen' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[10.5px] text-text-schwach">{datum(e.tag)}</span>
          <h4 className="text-[14px] font-medium text-text-stark">{e.name}</h4>
        </div>
        <Zustandsmarke zustand={e.zustand} />
      </div>

      <div className="mt-1.5">
        <Kennzahlen e={e} />
      </div>

      {e.beschreibung ? (
        <p className="mt-2 text-[12.5px] leading-relaxed whitespace-pre-line text-text-leise">
          {e.beschreibung}
        </p>
      ) : null}

      {e.ersetztPlanId ? (
        <p className="mt-2.5 border-l-2 border-warnung pl-2.5 text-[12px] leading-relaxed text-warnung">
          Ersetzt eine bestehende Einheit:{' '}
          {ersetzt ? `${datum(ersetzt.tag)} · ${ersetzt.name}` : e.ersetztPlanId}. Die alte
          wird dabei in intervals.icu gelöscht.
        </p>
      ) : null}

      {/* Was genau übertragen wird — nicht die Darstellung in Takt. */}
      <div className="mt-3 border border-kontur bg-flaeche-2">
        <button
          type="button"
          onClick={() => setVorschauOffen((o) => !o)}
          aria-expanded={vorschauOffen}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left"
        >
          <span className="marke flex-1 text-[9.5px] text-text-leise">
            Was nach intervals.icu geht
          </span>
          <span aria-hidden className="font-mono text-[10px] text-text-schwach">
            {vorschauOffen ? '−' : '+'}
          </span>
        </button>
        {vorschauOffen ? (
          <pre className="overflow-x-auto border-t border-kontur px-3 py-2.5 font-mono text-[11px] leading-relaxed text-text-schwach">
            {e.nutzlast}
          </pre>
        ) : null}
      </div>

      {e.fehler ? (
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-negativ" role="alert">
          {e.fehler}
        </p>
      ) : null}
      {meldung && meldung !== e.fehler ? (
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-negativ" role="alert">
          {meldung}
        </p>
      ) : null}

      {e.zustand === 'uebertragen' ? (
        <p className="mt-2.5 font-mono text-[10.5px] text-positiv">
          In intervals.icu angelegt{e.icuEventId ? ` · ${e.icuEventId}` : ''}.
        </p>
      ) : null}

      {offen ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {e.ersetztPlanId && !fragtErsetzen ? (
            <button
              type="button"
              disabled={laeuft}
              onClick={() => setFragtErsetzen(true)}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] border border-warnung px-3 text-[12.5px] text-warnung disabled:opacity-50"
            >
              {e.zustand === 'freigegeben' ? 'Noch einmal versuchen' : 'Ersetzen …'}
            </button>
          ) : null}

          {e.ersetztPlanId && fragtErsetzen ? (
            <>
              <span className="text-[12.5px] text-text">
                Die bestehende Einheit wird gelöscht. Fortfahren?
              </span>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => void freigeben(true)}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] bg-warnung px-3 text-[12.5px] font-medium text-grund disabled:opacity-50"
              >
                Ersetzen und übertragen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => setFragtErsetzen(false)}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] border border-kontur px-3 text-[12.5px] text-text disabled:opacity-50"
              >
                Abbrechen
              </button>
            </>
          ) : null}

          {!e.ersetztPlanId ? (
            <button
              type="button"
              disabled={laeuft}
              onClick={() => void freigeben(false)}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] bg-text-stark px-3 text-[12.5px] font-medium text-grund disabled:cursor-not-allowed disabled:opacity-50"
            >
              {laeuft
                ? 'Überträgt …'
                : e.zustand === 'freigegeben'
                  ? 'Noch einmal versuchen'
                  : 'Freigeben und übertragen'}
            </button>
          ) : null}

          <button
            type="button"
            disabled={laeuft}
            onClick={() => void verwerfen()}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] border border-kontur px-3 text-[12.5px] text-text-leise disabled:opacity-50"
          >
            Verwerfen
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Satz({
  satz,
  bestehende,
  neuLaden,
}: {
  satz: SatzAnsicht
  bestehende: Bestehende
  neuLaden: () => void
}) {
  const verworfen = satz.verworfenAm !== null
  const [offen, setOffen] = useState(!verworfen)
  const [laeuft, setLaeuft] = useState(false)
  const [sammelmeldung, setSammelmeldung] = useState<string | null>(null)

  const zahlen = useMemo(() => {
    const z = { vorschlag: 0, freigegeben: 0, uebertragen: 0, verworfen: 0 }
    for (const e of satz.einheiten) z[e.zustand] += 1
    return z
  }, [satz.einheiten])

  const wochen = useMemo(() => {
    const nach = new Map<string, EinheitAnsicht[]>()
    for (const e of satz.einheiten) {
      const { jahr, woche } = kalenderwoche(new Date(`${e.tag}T00:00:00`))
      const schluessel = `${jahr}-${String(woche).padStart(2, '0')}`
      const liste = nach.get(schluessel)
      if (liste) liste.push(e)
      else nach.set(schluessel, [e])
    }
    return [...nach.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [satz.einheiten])

  async function alleFreigeben() {
    setLaeuft(true)
    setSammelmeldung(null)
    try {
      const antwort = await fetch(
        `/api/plan/vorschlag/${encodeURIComponent(satz.id)}/freigeben`,
        { method: 'POST' },
      )
      const e = (await antwort.json()) as {
        uebertragen?: string[]
        gescheitert?: Array<{ id: string; fehler: string }>
        uebersprungen?: string[]
      }
      const teile: string[] = []
      teile.push(`${zahl(e.uebertragen?.length ?? 0)} übertragen`)
      if (e.gescheitert?.length) teile.push(`${zahl(e.gescheitert.length)} gescheitert`)
      if (e.uebersprungen?.length) {
        teile.push(
          `${zahl(e.uebersprungen.length)} übersprungen — sie ersetzen bestehende ` +
            'Einheiten und brauchen jede eine eigene Bestätigung',
        )
      }
      setSammelmeldung(teile.join(' · '))
      neuLaden()
    } catch {
      setSammelmeldung('Die Sammelfreigabe ist gescheitert.')
    } finally {
      setLaeuft(false)
    }
  }

  async function satzVerwerfen() {
    setLaeuft(true)
    try {
      await fetch(`/api/plan/vorschlag/${encodeURIComponent(satz.id)}`, { method: 'DELETE' })
      neuLaden()
      setOffen(false)
    } finally {
      setLaeuft(false)
    }
  }

  const offeneEinheiten = zahlen.vorschlag + zahlen.freigegeben

  return (
    <div className="border border-kontur bg-flaeche">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left md:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[14px] font-medium text-text-stark">
              {zahl(satz.wochen)} Wochen · {datum(satz.vonTag)} bis {datum(satz.bisTag)}
            </span>
            <Zeitmarke
              iso={satz.erstelltAm}
              className="font-mono text-[10.5px] text-text-schwach"
            />
          </div>
          <div className="mt-1.5 font-mono text-[10.5px] text-text-schwach">
            {zahl(satz.einheiten.length)} Einheiten · {zahl(zahlen.uebertragen)} übertragen
            {zahlen.freigegeben > 0 ? ` · ${zahl(zahlen.freigegeben)} gescheitert` : ''}
            {zahlen.vorschlag > 0 ? ` · ${zahl(zahlen.vorschlag)} offen` : ''}
            {verworfen ? ' · verworfen' : ''}
          </div>
          {satz.ziel ? (
            <div className="mt-1 truncate text-[12px] text-text-leise">Ziel: {satz.ziel}</div>
          ) : null}
        </div>
        <span aria-hidden className="font-mono text-[11px] text-text-schwach">
          {offen ? '−' : '+'}
        </span>
      </button>

      {verworfen ? (
        <p className="border-t border-kontur px-4 py-2 font-mono text-[10.5px] text-text-schwach md:px-5">
          Verworfen am {datum(satz.verworfenAm ?? '')} · verschwindet sieben Tage danach von
          selbst.
        </p>
      ) : null}

      {offen ? (
        <div className="border-t border-kontur p-4 md:p-5">
          {satz.begruendung ? (
            <p className="mb-4 border-l-2 border-akzent pl-3 text-[13px] leading-relaxed whitespace-pre-line text-text">
              {satz.begruendung}
            </p>
          ) : null}

          {!verworfen && offeneEinheiten > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => void alleFreigeben()}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] bg-text-stark px-4 text-[13px] font-medium text-grund disabled:cursor-not-allowed disabled:opacity-50"
              >
                {laeuft ? 'Überträgt …' : `Alle freigeben (${zahl(offeneEinheiten)})`}
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => void satzVerwerfen()}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-[2px] border border-kontur px-3 text-[12.5px] text-text-leise disabled:opacity-50"
              >
                Satz verwerfen
              </button>
              <span className="font-mono text-[10.5px] text-text-schwach">
                Freigeben überträgt sofort nach intervals.icu.
              </span>
            </div>
          ) : null}

          {sammelmeldung ? (
            <p className="mb-4 text-[12.5px] leading-relaxed text-text" role="status">
              {sammelmeldung}
            </p>
          ) : null}

          <div className="space-y-5">
            {wochen.map(([schluessel, einheiten]) => (
              <div key={schluessel}>
                <div className="marke mb-2 text-[9.5px] text-text-schwach">
                  KW {schluessel.slice(5)}
                </div>
                <div className="space-y-px">
                  {einheiten.map((e) => (
                    <Einheit key={e.id} e={e} bestehende={bestehende} neuLaden={neuLaden} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function PlanVorschlaege({
  saetze,
  bestehende,
}: {
  saetze: SatzAnsicht[]
  bestehende: Bestehende
}) {
  /*
   * Die Sätze kommen bei jedem Aufruf frisch vom Server und werden hier
   * **nicht** in einen eigenen Zustand kopiert. Eine Kopie bliebe stehen,
   * wenn router.refresh() neue Daten bringt — ein soeben bestellter Satz
   * tauchte dann gar nicht auf.
   */
  const router = useRouter()
  const neuLaden = () => router.refresh()

  if (saetze.length === 0) return null

  const aktuelle = saetze.filter((s) => s.verworfenAm === null)
  const verworfene = saetze.filter((s) => s.verworfenAm !== null)

  return (
    <div className="space-y-5">
      {aktuelle.length > 0 ? (
        <div className="space-y-px">
          {aktuelle.map((s) => (
            <Satz key={s.id} satz={s} bestehende={bestehende} neuLaden={neuLaden} />
          ))}
        </div>
      ) : null}

      {verworfene.length > 0 ? (
        <div>
          <div className="marke mb-2 text-[9.5px] text-text-schwach">
            Verworfen · {zahl(verworfene.length)}
          </div>
          <div className="space-y-px">
            {verworfene.map((s) => (
              <Satz key={s.id} satz={s} bestehende={bestehende} neuLaden={neuLaden} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
