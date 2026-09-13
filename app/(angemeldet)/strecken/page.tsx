import { Leer } from '@/komponenten/zustaende'
import { alleStrecken } from '@/lib/daten/rest'
import { datum, strecke, zahl } from '@/lib/format'

export const metadata = { title: 'Strecken — Takt' }

export default async function Strecken() {
  const zeilen = await alleStrecken()

  if (zeilen.length === 0) {
    return (
      <div className="p-5 md:p-6">
        <Leer
          titel="Noch keine wiederkehrenden Strecken"
          hinweis={
            'Takt erkennt Strecken selbst — intervals.icu liefert sie nicht. Dafür ' +
            'braucht es die Verläufe, die beim Öffnen einer Aktivität geholt werden. ' +
            'Je mehr Läufe geöffnet wurden, desto mehr Runden findet Takt.'
          }
          aktion={{ name: 'Zu den Aktivitäten', pfad: '/aktivitaeten' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Strecken</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          {zahl(zeilen.length)} erkannt
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-kontur sm:grid-cols-2 xl:grid-cols-3">
        {zeilen.map((s) => (
          <article key={s.id} className="bg-flaeche p-5">
            <h2 className="text-[14px] text-text-stark">
              {s.name ?? `Runde über ${strecke(s.laengeMeter)}`}
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="marke text-[9px] text-text-schwach">Länge</dt>
                <dd className="mt-1 font-mono text-[13px] text-text-stark">
                  {strecke(s.laengeMeter)}
                </dd>
              </div>
              <div>
                <dt className="marke text-[9px] text-text-schwach">Gelaufen</dt>
                <dd className="mt-1 font-mono text-[13px] text-text-stark">
                  {zahl(s.anzahl)} ×
                </dd>
              </div>
            </dl>
            <p className="mt-3 font-mono text-[10.5px] text-text-schwach">
              {datum(s.erstMal)} bis {datum(s.letztMal)}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
