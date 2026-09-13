import Link from 'next/link'
import { Leer } from '@/komponenten/zustaende'
import { aktivitaetenSeite, SEITENGROESSE } from '@/lib/daten/aktivitaeten'
import { datum, dauer, pace, strecke, uhrzeit, zahl } from '@/lib/format'

export const metadata = { title: 'Aktivitäten — Takt' }

function paceAus(sekunden: number | null, meter: number | null): string {
  if (!sekunden || !meter || meter <= 0) return '–'
  return pace((sekunden / meter) * 1000)
}

export default async function Aktivitaeten({
  searchParams,
}: {
  searchParams: Promise<{ seite?: string }>
}) {
  const { seite: seiteRoh } = await searchParams
  const seite = Math.max(0, Number(seiteRoh ?? '0') || 0)
  const { zeilen, gesamt } = await aktivitaetenSeite(seite)

  if (gesamt === 0) {
    return (
      <div className="p-5 md:p-6">
        <Leer
          titel="Noch keine Aktivitäten"
          hinweis="Sobald der erste Abgleich gelaufen ist, stehen die Läufe hier."
          aktion={{ name: 'Zugang einrichten', pfad: '/mehr' }}
        />
      </div>
    )
  }

  const letzteSeite = Math.max(0, Math.ceil(gesamt / SEITENGROESSE) - 1)

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <h1 className="text-[20px] font-semibold text-text-stark">Aktivitäten</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          {zahl(gesamt)} Einheiten
        </p>
      </div>

      {/* Am Telefon Karten. Eine Tabelle müsste dort waagrecht scrollen. */}
      <div className="space-y-px md:hidden">
        {zeilen.map((a) => (
          <Link
            key={a.id}
            href={`/aktivitaeten/${a.id}`}
            className="block border border-kontur bg-flaeche p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[14px] text-text-stark">
                {a.name ?? 'Ohne Namen'}
              </span>
              <span className="flex-none font-mono text-[11px] text-text-schwach">
                {datum(a.beginn)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[12px]">
              <div>
                <div className="marke text-[9px] text-text-schwach">Strecke</div>
                <div className="mt-1 text-text-stark">
                  {a.streckeMeter === null ? '–' : strecke(a.streckeMeter)}
                </div>
              </div>
              <div>
                <div className="marke text-[9px] text-text-schwach">Dauer</div>
                <div className="mt-1 text-text-stark">
                  {a.dauerSekunden === null ? '–' : dauer(a.dauerSekunden)}
                </div>
              </div>
              <div>
                <div className="marke text-[9px] text-text-schwach">Pace</div>
                <div className="mt-1 text-text-stark">
                  {paceAus(a.dauerSekunden, a.streckeMeter)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Am Schreibtisch die Tabelle aus dem Entwurf. */}
      <div className="hidden border border-kontur bg-flaeche md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-kontur">
              {['Datum', 'Name', 'Strecke', 'Dauer', 'Pace', 'Puls', 'Belastung'].map((s) => (
                <th
                  key={s}
                  scope="col"
                  className="marke px-4 py-3 text-[9.5px] font-medium text-text-schwach"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((a) => (
              <tr key={a.id} className="border-b border-kontur last:border-b-0 hover:bg-flaeche-2">
                <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-text-leise">
                  {datum(a.beginn)}
                  <span className="ml-2 text-text-schwach">{uhrzeit(a.beginn)}</span>
                </td>
                <td className="max-w-0 px-4 py-3 text-[13.5px]">
                  <Link
                    href={`/aktivitaeten/${a.id}`}
                    className="block truncate text-text-stark hover:text-akzent"
                  >
                    {a.name ?? 'Ohne Namen'}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-[12.5px] whitespace-nowrap text-text">
                  {a.streckeMeter === null ? '–' : strecke(a.streckeMeter)}
                </td>
                <td className="px-4 py-3 font-mono text-[12.5px] whitespace-nowrap text-text">
                  {a.dauerSekunden === null ? '–' : dauer(a.dauerSekunden)}
                </td>
                <td className="px-4 py-3 font-mono text-[12.5px] whitespace-nowrap text-text">
                  {paceAus(a.dauerSekunden, a.streckeMeter)}
                </td>
                <td className="px-4 py-3 font-mono text-[12.5px] whitespace-nowrap text-text">
                  {a.pulsSchnitt === null ? '–' : zahl(a.pulsSchnitt)}
                </td>
                <td className="px-4 py-3 font-mono text-[12.5px] whitespace-nowrap text-text">
                  {a.belastung === null ? '–' : zahl(a.belastung)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {letzteSeite > 0 ? (
        <div className="flex items-center justify-between gap-3">
          {seite > 0 ? (
            <Link
              href={`/aktivitaeten?seite=${seite - 1}`}
              className="inline-flex min-h-11 items-center rounded-[2px] border border-kontur px-4 text-[13px] text-text"
            >
              Neuer
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11.5px] text-text-schwach">
            Seite {zahl(seite + 1)} von {zahl(letzteSeite + 1)}
          </span>
          {seite < letzteSeite ? (
            <Link
              href={`/aktivitaeten?seite=${seite + 1}`}
              className="inline-flex min-h-11 items-center rounded-[2px] border border-kontur px-4 text-[13px] text-text"
            >
              Älter
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  )
}
