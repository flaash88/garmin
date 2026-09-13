import { Kachel, Leer } from '@/komponenten/zustaende'
import { planZeitraum } from '@/lib/daten/rest'
import { aktivitaetenAb } from '@/lib/daten/aktivitaeten'
import { kalenderwoche, montagDerWoche, tagText } from '@/lib/daten/zeit'
import { datum, strecke, zahl } from '@/lib/format'

export const metadata = { title: 'Plan — Takt' }

const KUERZEL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export default async function Plan() {
  const heute = new Date()
  const montag = montagDerWoche(heute)
  const sonntag = new Date(montag)
  sonntag.setUTCDate(sonntag.getUTCDate() + 6)

  const [eintraege, gelaufen] = await Promise.all([
    planZeitraum(montag, sonntag),
    aktivitaetenAb(montag),
  ])

  const { woche: kw } = kalenderwoche(heute)

  const tage = KUERZEL.map((kuerzel, i) => {
    const d = new Date(montag)
    d.setUTCDate(d.getUTCDate() + i)
    const t = d.toISOString().slice(0, 10)
    return {
      tag: t,
      kuerzel,
      istHeute: t === tagText(heute),
      geplant: eintraege.filter((e) => e.tag === t),
      gelaufen: gelaufen.filter((a) => tagText(a.beginn) === t),
    }
  })

  if (eintraege.length === 0) {
    return (
      <div className="space-y-5 p-5 md:p-6">
        <div>
          <h1 className="text-[20px] font-semibold text-text-stark">Plan</h1>
          <p className="marke mt-1.5 text-[10px] text-text-schwach">KW {kw}</p>
        </div>
        <Leer
          titel="Für diese Woche ist kein Plan angelegt."
          hinweis={
            'Geplante Einheiten kommen aus dem Kalender von intervals.icu. Takt liest ' +
            'sie und schreibt Anpassungen dorthin zurück.'
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Plan</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          KW {kw} · {zahl(eintraege.length)} Einheiten geplant
        </p>
      </div>

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
            {t.geplant.length === 0 ? (
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
