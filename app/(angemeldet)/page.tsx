import Link from 'next/link'
import { Kachel, Leer } from '@/komponenten/zustaende'
import {
  anzahlAktivitaeten,
  dieseWoche,
  formkachel,
  naechsteEinheit,
  wochenkachel,
} from '@/lib/daten/uebersicht'
import { kalenderwoche } from '@/lib/daten/zeit'
import { datum, mitVorzeichen, strecke, zahl } from '@/lib/format'

const WOCHENTAGE = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag',
] as const

function Wert({
  marke,
  kuerzel,
  wert,
  fussnote,
  ton = 'normal',
}: {
  marke: string
  kuerzel: string
  wert: string
  fussnote: string
  ton?: 'normal' | 'positiv' | 'warnung'
}) {
  const tonKlasse =
    ton === 'positiv' ? 'text-positiv' : ton === 'warnung' ? 'text-warnung' : 'text-text-schwach'
  return (
    <section className="border border-kontur bg-flaeche p-5">
      <div className="flex items-baseline gap-2">
        <span className="marke text-[10px] text-text-schwach">{marke}</span>
        <span className="font-mono text-[10px] text-text-schwach">{kuerzel}</span>
      </div>
      <div className="mt-3 font-mono text-[30px] leading-none text-text-stark">{wert}</div>
      <div className={`mt-2 font-mono text-[11px] ${tonKlasse}`}>{fussnote}</div>
    </section>
  )
}

export default async function Uebersicht() {
  const anzahl = await anzahlAktivitaeten()

  if (anzahl === 0) {
    return (
      <div className="p-5 md:p-6">
        <Leer
          titel="Noch keine Daten"
          hinweis={
            'Takt hat noch nichts von intervals.icu geholt. Die Erstbefüllung zieht ' +
            'zwölf Monate Aktivitäten und Wellness — ohne Verläufe, die kommen beim ' +
            'ersten Öffnen einer Aktivität.'
          }
          aktion={{ name: 'Zugang einrichten', pfad: '/mehr' }}
        />
      </div>
    )
  }

  const heute = new Date()
  const [form, woche, naechste, tage] = await Promise.all([
    formkachel(heute),
    wochenkachel(heute),
    naechsteEinheit(heute),
    dieseWoche(heute),
  ])

  const { woche: kw } = kalenderwoche(heute)
  const wochentag = WOCHENTAGE[heute.getDay()] ?? ''
  const hoechsteBelastung = Math.max(1, ...tage.map((t) => t.belastung))

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Übersicht</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          {wochentag}, {datum(heute)} · KW {kw}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-kontur sm:grid-cols-2 xl:grid-cols-3">
        <Wert
          marke="Form"
          kuerzel="TSB"
          wert={form?.form == null ? '–' : mitVorzeichen(form.form, 0)}
          fussnote={
            form?.formVorSiebenTagen == null
              ? 'kein Vergleich'
              : `vor 7 Tagen ${mitVorzeichen(form.formVorSiebenTagen, 0)}`
          }
        />
        <Wert
          marke="Fitness"
          kuerzel="CTL"
          wert={form?.fitness == null ? '–' : zahl(form.fitness, 0)}
          fussnote={
            form?.rampe == null
              ? 'kein Vergleich'
              : `${mitVorzeichen(form.rampe.jeWoche, 1)} / Woche`
          }
          ton={form?.rampe?.warnt ? 'warnung' : 'normal'}
        />
        <Wert
          marke="Ermüdung"
          kuerzel="ATL"
          wert={form?.ermuedung == null ? '–' : zahl(form.ermuedung, 0)}
          fussnote={
            form?.ermuedung == null || form.ermuedungVorwoche == null
              ? 'kein Vergleich'
              : `${mitVorzeichen(form.ermuedung - form.ermuedungVorwoche, 0)} zur Vorwoche`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Kachel
          marke="Wochenkilometer"
          nebenmarke={
            woche.anteil === null ? 'ohne Vorgabe' : `${zahl(woche.anteil * 100, 0)} %`
          }
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[30px] leading-none text-text-stark">
              {zahl(woche.gelaufenMeter / 1000, 1)}
            </span>
            <span className="font-mono text-[13px] text-text-schwach">km</span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-text-schwach">
            {woche.vorgabeMeter === null
              ? woche.planAngelegt
                ? 'Plan ohne Streckenvorgabe'
                : 'Keine Vorgabe — Plan nicht angelegt'
              : `Vorgabe ${zahl(woche.vorgabeMeter / 1000, 1)}`}
          </div>

          {woche.vorgabeMeter === null ? null : (
            <div className="mt-4 h-1.5 w-full bg-flaeche-2">
              <div
                className="h-full bg-akzent"
                style={{ width: `${Math.min(100, (woche.anteil ?? 0) * 100)}%` }}
              />
            </div>
          )}
        </Kachel>

        <Kachel
          marke="Nächste Einheit"
          nebenmarke={
            naechste === null
              ? 'nicht geplant'
              : naechste.inTagen === 0
                ? 'heute'
                : naechste.inTagen === 1
                  ? 'morgen'
                  : `in ${naechste.inTagen} Tagen`
          }
        >
          {naechste === null ? (
            <div>
              <p className="text-[13.5px] text-text">
                Für diese Woche ist kein Plan angelegt.
              </p>
              <Link
                href="/plan"
                className="mt-4 inline-flex min-h-11 items-center rounded-[2px] bg-text-stark px-4 text-[14px] font-medium text-grund"
              >
                Woche planen
              </Link>
            </div>
          ) : (
            <div>
              <div className="font-mono text-[11px] text-text-schwach">
                {datum(naechste.tag)}
              </div>
              <div className="marke mt-2 text-[12px] text-text-stark">
                {naechste.name ?? naechste.typ ?? 'Einheit'}
              </div>
              {naechste.beschreibung ? (
                <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-text-leise">
                  {naechste.beschreibung}
                </p>
              ) : null}
            </div>
          )}
        </Kachel>
      </div>

      <Kachel marke="Diese Woche">
        <div className="grid grid-cols-7 gap-1">
          {tage.map((t) => (
            <div key={t.tag} className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-full items-end bg-flaeche-2">
                <div
                  className={t.istHeute ? 'w-full bg-akzent' : 'w-full bg-kontur-stark'}
                  style={{
                    height: `${Math.max(t.belastung > 0 ? 6 : 0, (t.belastung / hoechsteBelastung) * 100)}%`,
                  }}
                />
              </div>
              <span
                className={`marke text-[9.5px] ${t.istHeute ? 'text-akzent' : 'text-text-schwach'}`}
              >
                {t.kuerzel}
              </span>
              <span className="font-mono text-[10px] text-text-schwach">
                {t.streckeMeter > 0 ? strecke(t.streckeMeter) : '–'}
              </span>
            </div>
          ))}
        </div>
      </Kachel>
    </div>
  )
}
