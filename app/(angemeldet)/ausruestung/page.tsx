import { Leer } from '@/komponenten/zustaende'
import { alleAusruestung } from '@/lib/daten/rest'
import { strecke, zahl } from '@/lib/format'

export const metadata = { title: 'Ausrüstung — Takt' }

/** Ab hier gilt ein Schuh als verbraucht. Übliche Faustregel. */
const GRENZE_METER = 800_000

export default async function Ausruestung() {
  const zeilen = await alleAusruestung()

  if (zeilen.length === 0) {
    return (
      <div className="p-5 md:p-6">
        <Leer
          titel="Noch keine Ausrüstung"
          hinweis="Schuhe und ihre Laufleistung kommen aus intervals.icu."
          aktion={{ name: 'Zugang einrichten', pfad: '/mehr' }}
        />
      </div>
    )
  }

  const inBenutzung = zeilen.filter((z) => z.inBenutzung === 1)
  const stillgelegt = zeilen.filter((z) => z.inBenutzung !== 1)

  function Karte({ z }: { z: (typeof zeilen)[number] }) {
    const gelaufen = z.laufleistungMeter ?? 0
    const anteil = Math.min(1, gelaufen / GRENZE_METER)
    const ton =
      anteil >= 1 ? 'bg-negativ' : anteil >= 0.75 ? 'bg-warnung' : 'bg-akzent'
    return (
      <article className="bg-flaeche p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-[14px] text-text-stark">{z.name}</h2>
          {z.art ? (
            <span className="marke flex-none text-[9px] text-text-schwach">{z.art}</span>
          ) : null}
        </div>
        <div className="mt-3 font-mono text-[22px] leading-none text-text-stark">
          {strecke(gelaufen)}
        </div>
        <div className="mt-3 h-1.5 w-full bg-flaeche-2">
          <div className={`h-full ${ton}`} style={{ width: `${anteil * 100}%` }} />
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-text-schwach">
          {anteil >= 1
            ? `über ${zahl(GRENZE_METER / 1000, 0)} km — Wechsel erwägen`
            : `${zahl(anteil * 100, 0)} % von ${zahl(GRENZE_METER / 1000, 0)} km`}
        </p>
      </article>
    )
  }

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Ausrüstung</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          {zahl(inBenutzung.length)} in Benutzung
          {stillgelegt.length > 0 ? ` · ${zahl(stillgelegt.length)} stillgelegt` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-kontur sm:grid-cols-2 xl:grid-cols-3">
        {inBenutzung.map((z) => (
          <Karte key={z.id} z={z} />
        ))}
      </div>

      {stillgelegt.length > 0 ? (
        <>
          <h2 className="marke pt-2 text-[10px] text-text-schwach">Stillgelegt</h2>
          <div className="grid grid-cols-1 gap-px bg-kontur opacity-60 sm:grid-cols-2 xl:grid-cols-3">
            {stillgelegt.map((z) => (
              <Karte key={z.id} z={z} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
