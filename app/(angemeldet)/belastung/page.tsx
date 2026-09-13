import { Kachel, Leer } from '@/komponenten/zustaende'
import { aktivitaetenAb } from '@/lib/daten/aktivitaeten'
import { wellnessZeitraum } from '@/lib/daten/rest'
import { monotonie, RAMPE_WARNSCHWELLE, rampe } from '@/lib/analyse/belastung'
import { tagText, tageZurueck } from '@/lib/daten/zeit'
import { datum, mitVorzeichen, strecke, zahl } from '@/lib/format'

export const metadata = { title: 'Belastung — Takt' }

export default async function Belastung() {
  const heute = new Date()
  const von = tageZurueck(90, heute)

  const [laeufe, tage] = await Promise.all([
    aktivitaetenAb(von),
    wellnessZeitraum(von, heute),
  ])

  if (laeufe.length === 0 && tage.length === 0) {
    return (
      <div className="p-5 md:p-6">
        <Leer
          titel="Noch keine Belastungsdaten"
          hinweis="CTL, ATL und Form kommen von intervals.icu. Monotonie und Rampe rechnet Takt selbst."
          aktion={{ name: 'Zugang einrichten', pfad: '/mehr' }}
        />
      </div>
    )
  }

  const tagesbelastung = new Map<string, number>()
  for (const l of laeufe) {
    const t = tagText(l.beginn)
    tagesbelastung.set(t, (tagesbelastung.get(t) ?? 0) + (l.belastung ?? 0))
  }
  const alsListe = [...tagesbelastung].map(([tag, belastung]) => ({ tag, belastung }))

  const mono = monotonie(alsListe, tagText(heute))

  const jetztCtl = tage.at(-1)?.ctl ?? null
  const vorVier = tage.find((t) => t.tag >= tagText(tageZurueck(28, heute)))?.ctl ?? null
  const anstieg = jetztCtl !== null && vorVier !== null ? rampe(vorVier, jetztCtl) : null

  const letzte28 = Array.from({ length: 28 }, (_, i) => {
    const d = tageZurueck(27 - i, heute)
    const t = tagText(d)
    return { tag: t, belastung: tagesbelastung.get(t) ?? 0 }
  })
  const hoechste = Math.max(1, ...letzte28.map((t) => t.belastung))

  const gesamtStrecke = laeufe.reduce((s, l) => s + (l.streckeMeter ?? 0), 0)

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Belastung</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          90 Tage · {zahl(laeufe.length)} Einheiten · {strecke(gesamtStrecke)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-kontur sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-flaeche p-5">
          <div className="marke text-[10px] text-text-schwach">Wochenbelastung</div>
          <div className="mt-3 font-mono text-[26px] leading-none text-text-stark">
            {mono === null ? '–' : zahl(mono.wochenbelastung, 0)}
          </div>
          <div className="mt-2 font-mono text-[11px] text-text-schwach">letzte 7 Tage</div>
        </div>

        <div className="bg-flaeche p-5">
          <div className="marke text-[10px] text-text-schwach">Monotonie</div>
          <div className="mt-3 font-mono text-[26px] leading-none text-text-stark">
            {mono?.monotonie == null ? '–' : zahl(mono.monotonie, 2)}
          </div>
          <div className="mt-2 font-mono text-[11px] text-text-schwach">
            {mono?.monotonie == null
              ? 'alle Tage gleich — nicht bestimmbar'
              : `Streuung ${zahl(mono.streuung, 1)}`}
          </div>
        </div>

        <div className="bg-flaeche p-5">
          <div className="marke text-[10px] text-text-schwach">Belastungsdruck</div>
          <div className="mt-3 font-mono text-[26px] leading-none text-text-stark">
            {mono?.belastungsdruck == null ? '–' : zahl(mono.belastungsdruck, 0)}
          </div>
          <div className="mt-2 font-mono text-[11px] text-text-schwach">
            Wochenbelastung × Monotonie
          </div>
        </div>

        <div className="bg-flaeche p-5">
          <div className="marke text-[10px] text-text-schwach">Rampe</div>
          <div
            className={`mt-3 font-mono text-[26px] leading-none ${anstieg?.warnt ? 'text-warnung' : 'text-text-stark'}`}
          >
            {anstieg === null ? '–' : mitVorzeichen(anstieg.jeWoche, 1)}
          </div>
          <div
            className={`mt-2 font-mono text-[11px] ${anstieg?.warnt ? 'text-warnung' : 'text-text-schwach'}`}
          >
            {anstieg === null
              ? 'kein Vergleich'
              : anstieg.warnt
                ? `über der Schwelle ${zahl(RAMPE_WARNSCHWELLE, 1)}`
                : `Schwelle ${zahl(RAMPE_WARNSCHWELLE, 1)} je Woche`}
          </div>
        </div>
      </div>

      <Kachel marke="Tagesbelastung" nebenmarke="28 Tage">
        <div className="flex h-32 items-end gap-px" aria-hidden>
          {letzte28.map((t) => (
            <div key={t.tag} className="flex h-full flex-1 items-end bg-flaeche-2">
              <div
                className="w-full bg-akzent"
                style={{ height: `${(t.belastung / hoechste) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-text-schwach">
          <span>{datum(letzte28[0]?.tag ?? '')}</span>
          <span>{datum(letzte28.at(-1)?.tag ?? '')}</span>
        </div>
      </Kachel>
    </div>
  )
}
