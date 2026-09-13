import { Kachel, Leer } from '@/komponenten/zustaende'
import { PlanBestellen } from '@/komponenten/plan-bestellen'
import { PlanVorschlaege } from '@/komponenten/plan-vorschlaege'
import { ZielFormular } from '@/komponenten/ziel-formular'
import type { Bestehende, SatzAnsicht } from '@/komponenten/plan-typen'
import { planNachKennungen, planZeitraum } from '@/lib/daten/rest'
import { aktivitaetenAb } from '@/lib/daten/aktivitaeten'
import {
  einheitenImZeitraum,
  verworfeneAufraeumen,
  vorschlaegeListe,
} from '@/lib/daten/planvorschlaege'
import { zielLesen, zielSatz } from '@/lib/daten/einstellungen'
import { nutzlastText } from '@/lib/plan/nutzlast'
import { kalenderwoche, montagDerWoche, tageSpaeter, tagText } from '@/lib/daten/zeit'
import { datum, strecke, zahl } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Plan — Takt' }

const KUERZEL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export default async function Plan() {
  const heute = new Date()
  const montag = montagDerWoche(heute)
  const sonntag = tageSpaeter(6, montag)

  /*
   * Verworfene Sätze verschwinden sieben Tage nach dem Verwerfen. Aufgeräumt
   * wird beim Aufrufen der Seite: ein eigener Zeitplan wäre ein weiterer
   * Dienst, der laufen und überwacht werden müsste, für eine Aufgabe, die
   * ohnehin nur auffällt, wenn jemand hersieht.
   */
  await verworfeneAufraeumen()

  const [eintraege, gelaufen, saetzeRoh, vorgeschlagen, ziel] = await Promise.all([
    planZeitraum(montag, sonntag),
    aktivitaetenAb(montag),
    vorschlaegeListe(),
    einheitenImZeitraum(tagText(montag), tagText(sonntag)),
    zielLesen(),
  ])

  const ersetzteKennungen = [
    ...new Set(
      saetzeRoh
        .flatMap((s) => s.einheiten)
        .map((e) => e.ersetztPlanId)
        .filter((id): id is string => id !== null),
    ),
  ]
  const bestehendeZeilen = await planNachKennungen(ersetzteKennungen)
  const bestehende: Bestehende = Object.fromEntries(
    bestehendeZeilen.map((z) => [z.id, { tag: z.tag, name: z.name ?? z.typ ?? 'Einheit' }]),
  )

  const saetze: SatzAnsicht[] = saetzeRoh.map((s) => ({
    id: s.vorschlag.id,
    ziel: s.vorschlag.ziel,
    vonTag: s.vorschlag.vonTag,
    bisTag: s.vorschlag.bisTag,
    wochen: s.vorschlag.wochen,
    begruendung: s.vorschlag.begruendung,
    erstelltAm: s.vorschlag.erstelltAm.toISOString(),
    verworfenAm: s.vorschlag.verworfenAm?.toISOString() ?? null,
    einheiten: s.einheiten.map((e) => ({
      id: e.id,
      tag: e.tag,
      name: e.name,
      typ: e.typ,
      beschreibung: e.beschreibung,
      dauerSekunden: e.dauerSekunden,
      streckeMeter: e.streckeMeter,
      zielBelastung: e.zielBelastung,
      ersetztPlanId: e.ersetztPlanId,
      zustand: e.zustand,
      icuEventId: e.icuEventId,
      fehler: e.fehler,
      // Aus derselben Funktion wie die Übertragung — siehe lib/plan/nutzlast.ts.
      nutzlast: nutzlastText(e),
    })),
  }))

  const { woche: kw } = kalenderwoche(heute)

  const tage = KUERZEL.map((kuerzel, i) => {
    const t = tagText(tageSpaeter(i, montag))
    return {
      tag: t,
      kuerzel,
      istHeute: t === tagText(heute),
      geplant: eintraege.filter((e) => e.tag === t),
      /*
       * Verworfene sind hier bewusst nicht dabei — sie bleiben beim Satz.
       * Und was übertragen **und** inzwischen abgeglichen ist, steht schon
       * als geplante Einheit da; zweimal im selben Kästchen wäre es einmal
       * zu viel.
       */
      vorgeschlagen: vorgeschlagen.filter(
        (e) =>
          e.tag === t &&
          (e.icuEventId === null || !eintraege.some((p) => p.id === e.icuEventId)),
      ),
      gelaufen: gelaufen.filter((a) => tagText(a.beginn) === t),
    }
  })

  const kopf = (
    <>
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Plan</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          KW {kw} · {zahl(eintraege.length)} Einheiten geplant
        </p>
      </div>
      <ZielFormular ziel={ziel} />
      <PlanBestellen zielImProfil={zielSatz(ziel)} />
      <PlanVorschlaege saetze={saetze} bestehende={bestehende} />
    </>
  )

  if (eintraege.length === 0 && vorgeschlagen.length === 0) {
    return (
      <div className="space-y-5 p-5 md:p-6">
        {kopf}
        <Leer
          titel="Für diese Woche ist kein Plan angelegt."
          hinweis={
            'Geplante Einheiten kommen aus dem Kalender von intervals.icu. Takt liest ' +
            'sie und schreibt Anpassungen dorthin zurück — erst nach deiner Freigabe.'
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5 md:p-6">
      {kopf}

      {/* Am Telefon Tagesliste, am Schreibtisch das Wochenraster. */}
      <div className="space-y-px md:hidden">
        {tage.map((t) => (
          <div
            key={t.tag}
            className={`border bg-flaeche p-4 ${t.istHeute ? 'border-akzent' : 'border-kontur'}`}
          >
            <div className="flex items-baseline justify-between">
              <span className={`marke text-[10px] ${t.istHeute ? 'text-akzent' : 'text-text-schwach'}`}>
                {t.kuerzel}
              </span>
              <span className="font-mono text-[11px] text-text-schwach">{datum(t.tag)}</span>
            </div>
            {t.geplant.length === 0 && t.vorgeschlagen.length === 0 ? (
              <p className="mt-2 font-mono text-[11.5px] text-text-schwach">nichts geplant</p>
            ) : (
              t.geplant.map((e) => (
                <div key={e.id} className="mt-2">
                  <div className="text-[13.5px] text-text-stark">{e.name ?? e.typ ?? 'Einheit'}</div>
                  {e.beschreibung ? (
                    <p className="mt-1 text-[12.5px] leading-relaxed whitespace-pre-line text-text-leise">
                      {e.beschreibung}
                    </p>
                  ) : null}
                </div>
              ))
            )}
            {t.vorgeschlagen.map((e) => (
              <div key={e.id} className="mt-2 border-l-2 border-dashed border-text-schwach pl-2">
                <div className="text-[13px] text-text-leise">{e.name}</div>
                <div className="mt-0.5 marke text-[9.5px] text-text-schwach">
                  {e.zustand === 'uebertragen'
                    ? 'übertragen'
                    : e.zustand === 'freigegeben'
                      ? 'Übertragung gescheitert'
                      : 'Vorschlag'}
                </div>
              </div>
            ))}
            {t.gelaufen.length > 0 ? (
              <div className="mt-3 border-t border-kontur pt-2 font-mono text-[11px] text-positiv">
                gelaufen ·{' '}
                {strecke(t.gelaufen.reduce((s, a) => s + (a.streckeMeter ?? 0), 0))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Kachel marke={`Woche ${kw}`}>
          <div className="grid grid-cols-7 gap-px bg-kontur">
            {tage.map((t) => (
              <div key={t.tag} className="min-h-40 bg-flaeche p-3">
                <div className="flex items-baseline justify-between">
                  <span className={`marke text-[9.5px] ${t.istHeute ? 'text-akzent' : 'text-text-schwach'}`}>
                    {t.kuerzel}
                  </span>
                  <span className="font-mono text-[10px] text-text-schwach">
                    {t.tag.slice(8)}.{t.tag.slice(5, 7)}.
                  </span>
                </div>
                {t.geplant.map((e) => (
                  <div key={e.id} className="mt-2 border-l-2 border-akzent pl-2">
                    <div className="text-[12.5px] text-text-stark">
                      {e.name ?? e.typ ?? 'Einheit'}
                    </div>
                    {e.zielStreckeMeter ? (
                      <div className="mt-0.5 font-mono text-[10.5px] text-text-schwach">
                        {strecke(e.zielStreckeMeter)}
                      </div>
                    ) : null}
                  </div>
                ))}
                {t.vorgeschlagen.map((e) => (
                  <div
                    key={e.id}
                    className={`mt-2 border-l-2 pl-2 ${
                      e.zustand === 'uebertragen'
                        ? 'border-positiv'
                        : e.zustand === 'freigegeben'
                          ? 'border-negativ'
                          : 'border-dashed border-text-schwach'
                    }`}
                  >
                    <div className="text-[12.5px] text-text-leise">{e.name}</div>
                    <div className="marke mt-0.5 text-[9px] text-text-schwach">
                      {e.zustand === 'uebertragen'
                        ? 'übertragen'
                        : e.zustand === 'freigegeben'
                          ? 'gescheitert'
                          : 'Vorschlag'}
                    </div>
                  </div>
                ))}
                {t.gelaufen.map((a) => (
                  <div key={a.id} className="mt-2 border-l-2 border-positiv pl-2">
                    <div className="font-mono text-[10.5px] text-positiv">
                      {a.streckeMeter === null ? 'gelaufen' : strecke(a.streckeMeter)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Kachel>
      </div>
    </div>
  )
}
