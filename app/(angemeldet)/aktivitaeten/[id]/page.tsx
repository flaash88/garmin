import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Karte } from '@/komponenten/karte'
import { Kachel } from '@/komponenten/zustaende'
import { aktivitaet, streckeZurAktivitaet } from '@/lib/daten/aktivitaeten'
import { rundenAusRohdaten, spurAusVerlauf, verlaufBesorgen } from '@/lib/daten/verlauf'
import { splitGuete, verfall } from '@/lib/analyse/splits'
import { ausduennen } from '@/lib/analyse/strecken'
import { datum, dauer, mitVorzeichen, pace, strecke, uhrzeit, zahl } from '@/lib/format'

export default async function AktivitaetDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const a = await aktivitaet(id)
  if (!a) notFound()

  const { daten, fehler } = await verlaufBesorgen(id)
  // Ausgedünnt, bevor die Spur in den Client geht: eine Stunde Aufzeichnung
  // sind über zehntausend Punkte, und die Karte zeigt davon nur den Verlauf.
  const spur = ausduennen(spurAusVerlauf(daten))
  const runden = rundenAusRohdaten(a.rohdaten)
  const zugeordnet = await streckeZurAktivitaet(id)

  const guete =
    runden.length >= 2
      ? splitGuete(
          runden
            .filter((r) => r.sekunden !== null && r.meter !== null)
            .map((r) => ({ sekunden: r.sekunden ?? 0, meter: r.meter ?? 0 })),
        )
      : null
  const abfall =
    runden.length >= 3
      ? verfall(
          runden
            .filter((r) => r.sekunden !== null && r.meter !== null)
            .map((r) => ({ sekunden: r.sekunden ?? 0, meter: r.meter ?? 0 })),
        )
      : null

  const gesamtPace =
    a.dauerSekunden && a.streckeMeter && a.streckeMeter > 0
      ? pace((a.dauerSekunden / a.streckeMeter) * 1000)
      : '–'

  const kopfzahlen: Array<[string, string]> = [
    ['Strecke', a.streckeMeter === null ? '–' : strecke(a.streckeMeter)],
    ['Dauer', a.dauerSekunden === null ? '–' : dauer(a.dauerSekunden)],
    ['Pace', gesamtPace],
    ['Puls ⌀', a.pulsSchnitt === null ? '–' : `${zahl(a.pulsSchnitt)}`],
    ['Puls max', a.pulsMax === null ? '–' : `${zahl(a.pulsMax)}`],
    ['Belastung', a.belastung === null ? '–' : zahl(a.belastung)],
    ['Höhenmeter', a.hoehenmeter === null ? '–' : `${zahl(a.hoehenmeter, 0)} m`],
  ]

  return (
    <div className="space-y-5 p-5 md:p-6">
      <div>
        <Link
          href="/aktivitaeten"
          className="marke text-[9.5px] text-text-schwach hover:text-text"
        >
          ← Aktivitäten
        </Link>
        <h1 className="mt-2 text-[20px] font-semibold text-text-stark">
          {a.name ?? 'Ohne Namen'}
        </h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          {datum(a.beginn)} · {uhrzeit(a.beginn)} Uhr · {a.typ}
          {zugeordnet ? ` · ${zugeordnet.strecke.name ?? 'bekannte Strecke'}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-kontur sm:grid-cols-4 xl:grid-cols-7">
        {kopfzahlen.map(([marke, wert]) => (
          <div key={marke} className="bg-flaeche p-4">
            <div className="marke text-[9px] text-text-schwach">{marke}</div>
            <div className="mt-2 font-mono text-[17px] text-text-stark">{wert}</div>
          </div>
        ))}
      </div>

      {fehler ? (
        <div className="flex items-center gap-[9px] border border-kontur bg-flaeche px-4 py-3">
          <span className="size-1.5 flex-none rounded-full bg-warnung" />
          <span className="font-mono text-[11px] text-text-leise">
            Verlauf nicht geladen · {fehler}
          </span>
        </div>
      ) : null}

      <Karte spur={spur} />

      {runden.length > 0 ? (
        <Kachel
          marke="Runden"
          nebenmarke={`${zahl(runden.length)} · ${guete ? `Streuung ${zahl(guete.streuung, 1)} s/km` : ''}`}
        >
          {guete ? (
            <div className="mb-4 grid grid-cols-2 gap-px bg-kontur sm:grid-cols-4">
              <div className="bg-flaeche p-3">
                <div className="marke text-[9px] text-text-schwach">Pace ⌀</div>
                <div className="mt-1.5 font-mono text-[14px] text-text-stark">
                  {pace(guete.mittelPace)}
                </div>
              </div>
              <div className="bg-flaeche p-3">
                <div className="marke text-[9px] text-text-schwach">Streuung</div>
                <div className="mt-1.5 font-mono text-[14px] text-text-stark">
                  {zahl(guete.streuung, 1)} s
                </div>
              </div>
              <div className="bg-flaeche p-3">
                <div className="marke text-[9px] text-text-schwach">Spanne</div>
                <div className="mt-1.5 font-mono text-[14px] text-text-stark">
                  {zahl(guete.spanne, 1)} s
                </div>
              </div>
              <div className="bg-flaeche p-3">
                <div className="marke text-[9px] text-text-schwach">Verfall</div>
                <div className="mt-1.5 font-mono text-[14px] text-text-stark">
                  {abfall === null ? '–' : `${mitVorzeichen(abfall, 1)} s`}
                </div>
              </div>
            </div>
          ) : null}

          {/* Am Telefon Karten statt Tabelle. */}
          <div className="grid grid-cols-2 gap-px bg-kontur sm:grid-cols-3 md:hidden">
            {runden.map((r) => (
              <div key={r.nummer} className="bg-flaeche p-3">
                <div className="marke text-[9px] text-text-schwach">Runde {r.nummer}</div>
                <div className="mt-1.5 font-mono text-[14px] text-text-stark">
                  {r.sekunden && r.meter && r.meter > 0
                    ? pace((r.sekunden / r.meter) * 1000)
                    : '–'}
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-text-schwach">
                  {r.meter === null ? '–' : strecke(r.meter)} ·{' '}
                  {r.sekunden === null ? '–' : dauer(r.sekunden)}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-kontur">
                  {['Runde', 'Strecke', 'Dauer', 'Pace', 'Puls ⌀'].map((s) => (
                    <th
                      key={s}
                      scope="col"
                      className="marke py-2 pr-4 text-[9.5px] font-medium text-text-schwach"
                    >
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runden.map((r) => (
                  <tr key={r.nummer} className="border-b border-kontur last:border-b-0">
                    <td className="py-2 pr-4 font-mono text-[12.5px] text-text-leise">
                      {r.nummer}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[12.5px] text-text">
                      {r.meter === null ? '–' : strecke(r.meter)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[12.5px] text-text">
                      {r.sekunden === null ? '–' : dauer(r.sekunden)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[12.5px] text-text-stark">
                      {r.sekunden && r.meter && r.meter > 0
                        ? pace((r.sekunden / r.meter) * 1000)
                        : '–'}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[12.5px] text-text">
                      {r.pulsSchnitt === null ? '–' : zahl(r.pulsSchnitt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kachel>
      ) : null}
    </div>
  )
}
