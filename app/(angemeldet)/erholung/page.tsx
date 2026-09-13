import { Kachel, Leer } from '@/komponenten/zustaende'
import { leereFelder, naechte } from '@/lib/daten/rest'
import { datum, dauer, mitVorzeichen, zahl } from '@/lib/format'

export const metadata = { title: 'Erholung — Takt' }

/** Welches Wellness-Feld welche Spalte speist — für das Ausblenden nach E0.8. */
const HERKUNFT = {
  schlafSekunden: ['sleepSecs', 'sleepHours'],
  hrv: ['hrv'],
  ruhepuls: ['restingHR', 'resting_hr'],
  gewicht: ['weight'],
  befinden: ['mood', 'feel'],
} as const

export default async function Erholung() {
  const zeilen = await naechte(14)
  const leer = await leereFelder('wellness')

  if (zeilen.length === 0) {
    return (
      <div className="p-5 md:p-6">
        <Leer
          titel="Noch keine Nächte"
          hinweis="Schlaf, HRV und Ruhepuls kommen aus der Uhr über intervals.icu."
          aktion={{ name: 'Zugang einrichten', pfad: '/mehr' }}
        />
      </div>
    )
  }

  /*
   * Ein Feld wird ausgeblendet, wenn es über den gesamten geholten Bestand
   * nie befüllt war — nicht mit einem Strich gezeigt. Siehe DECISIONS.md,
   * E0.8. Solange die Tabelle feldbefuellung leer ist (vor der ersten
   * Erstbefüllung), wird nichts ausgeblendet.
   */
  function zeigen(spalte: keyof typeof HERKUNFT): boolean {
    if (leer.size === 0) return true
    return !HERKUNFT[spalte].every((feld) => leer.has(feld))
  }

  const hrvWerte = zeilen.map((z) => z.hrv).filter((w): w is number => w !== null)
  const basis = hrvWerte.length > 0 ? hrvWerte.reduce((a, b) => a + b, 0) / hrvWerte.length : null
  const aktuell = zeilen[0]?.hrv ?? null

  const spalten: Array<{ name: string; zeige: boolean; wert: (z: (typeof zeilen)[number]) => string }> = [
    { name: 'Schlaf', zeige: zeigen('schlafSekunden'), wert: (z) => (z.schlafSekunden === null ? '–' : dauer(z.schlafSekunden)) },
    { name: 'HRV', zeige: zeigen('hrv'), wert: (z) => (z.hrv === null ? '–' : `${zahl(z.hrv, 0)} ms`) },
    { name: 'Ruhepuls', zeige: zeigen('ruhepuls'), wert: (z) => (z.ruhepuls === null ? '–' : zahl(z.ruhepuls)) },
    { name: 'Gewicht', zeige: zeigen('gewicht'), wert: (z) => (z.gewicht === null ? '–' : `${zahl(z.gewicht, 1)} kg`) },
    { name: 'Befinden', zeige: zeigen('befinden'), wert: (z) => (z.befinden === null ? '–' : zahl(z.befinden)) },
  ]
  const sichtbar = spalten.filter((s) => s.zeige)

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Erholung</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          {zahl(zeilen.length)} Nächte · zuletzt {datum(zeilen[0]?.tag ?? '')}
        </p>
      </div>

      {zeigen('hrv') && basis !== null ? (
        <Kachel
          marke="HRV"
          nebenmarke={`Basis ${zahl(basis, 0)} ms${aktuell === null ? '' : ` · aktuell ${zahl(aktuell, 0)} ms`}`}
        >
          <div className="flex items-end gap-1" aria-hidden>
            {[...zeilen].reverse().map((z) => {
              const hoehe = z.hrv === null ? 0 : Math.min(100, (z.hrv / (basis * 1.6)) * 100)
              return (
                <div key={z.tag} className="flex h-24 flex-1 items-end bg-flaeche-2">
                  <div
                    className={z.hrv !== null && z.hrv < basis ? 'w-full bg-warnung' : 'w-full bg-akzent'}
                    style={{ height: `${hoehe}%` }}
                  />
                </div>
              )
            })}
          </div>
          <p className="mt-3 font-mono text-[11px] text-text-schwach">
            {aktuell === null || basis === null
              ? 'kein Vergleich'
              : `${mitVorzeichen(aktuell - basis, 0)} ms gegenüber der Basis`}
          </p>
        </Kachel>
      ) : null}

      <div className="space-y-px md:hidden">
        {zeilen.map((z) => (
          <div key={z.tag} className="border border-kontur bg-flaeche p-4">
            <div className="font-mono text-[11.5px] text-text-schwach">{datum(z.tag)}</div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {sichtbar.map((s) => (
                <div key={s.name}>
                  <div className="marke text-[9px] text-text-schwach">{s.name}</div>
                  <div className="mt-1 font-mono text-[13px] text-text-stark">{s.wert(z)}</div>
                </div>
              ))}
            </div>
            {z.beschwerden || z.notizen ? (
              <p className="mt-3 border-t border-kontur pt-3 text-[12.5px] leading-relaxed text-text-leise">
                {[z.beschwerden, z.notizen].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto border border-kontur bg-flaeche md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-kontur">
              <th scope="col" className="marke px-4 py-3 text-[9.5px] font-medium text-text-schwach">
                Datum
              </th>
              {sichtbar.map((s) => (
                <th key={s.name} scope="col" className="marke px-4 py-3 text-[9.5px] font-medium text-text-schwach">
                  {s.name}
                </th>
              ))}
              <th scope="col" className="marke px-4 py-3 text-[9.5px] font-medium text-text-schwach">
                Beschwerden, Notizen
              </th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.tag} className="border-b border-kontur last:border-b-0">
                <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-text-leise">
                  {datum(z.tag)}
                </td>
                {sichtbar.map((s) => (
                  <td key={s.name} className="px-4 py-3 font-mono text-[12.5px] whitespace-nowrap text-text">
                    {s.wert(z)}
                  </td>
                ))}
                <td className="px-4 py-3 text-[12.5px] text-text-leise">
                  {[z.beschwerden, z.notizen].filter(Boolean).join(' · ') || '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
