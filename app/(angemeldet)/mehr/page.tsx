import Link from 'next/link'
import type { Route } from 'next'
import { AbgleichKnopf } from '@/komponenten/abgleich-knopf'
import { ThemaUmschalter } from '@/komponenten/thema-umschalter'
import { Kachel } from '@/komponenten/zustaende'
import { letzterAbgleich } from '@/lib/daten/abgleich'
import { datumZeit } from '@/lib/format'

export const metadata = { title: 'Mehr — Takt' }

const WEITERE: Array<{ pfad: Route; name: string; hinweis: string }> = [
  { pfad: '/erholung', name: 'Erholung', hinweis: 'Schlaf, HRV, Ruhepuls' },
  { pfad: '/belastung', name: 'Belastung', hinweis: 'Monotonie, Rampe, Zonen' },
  { pfad: '/strecken', name: 'Strecken', hinweis: 'wiederkehrende Runden' },
  { pfad: '/ausruestung', name: 'Ausrüstung', hinweis: 'Schuhe und Laufleistung' },
]

export default async function Mehr() {
  const stand = await letzterAbgleich()

  /*
   * Nur ob etwas hinterlegt ist, nie der Wert. Der Schlüssel verlässt den
   * Server nicht — auch nicht als gekürzte Anzeige.
   */
  const schluesselDa = Boolean(process.env['ICU_API_KEY'])
  const athlet = process.env['ICU_ATHLET_ID'] ?? null
  const { zugangPruefen } = await import('@/lib/coach/zugang')
  const coachZugang = zugangPruefen()

  return (
    <div className="space-y-5 p-5 md:p-6">
      <h1 className="text-[20px] font-semibold text-text-stark">Mehr</h1>

      <nav className="space-y-px" aria-label="Weitere Bereiche">
        {WEITERE.map((e) => (
          <Link
            key={e.pfad}
            href={e.pfad}
            className="flex min-h-11 items-center justify-between gap-3 border border-kontur bg-flaeche px-4 py-3.5"
          >
            <span>
              <span className="block text-[14px] text-text-stark">{e.name}</span>
              <span className="mt-0.5 block font-mono text-[10.5px] text-text-schwach">
                {e.hinweis}
              </span>
            </span>
            <span aria-hidden className="text-text-schwach">
              ›
            </span>
          </Link>
        ))}
      </nav>

      <Kachel marke="Zugang">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="marke text-[9px] text-text-schwach">Schlüssel</dt>
            <dd
              className={`mt-1.5 font-mono text-[12.5px] ${schluesselDa ? 'text-positiv' : 'text-negativ'}`}
            >
              {schluesselDa ? 'hinterlegt' : 'fehlt'}
            </dd>
          </div>
          <div>
            <dt className="marke text-[9px] text-text-schwach">Athlet</dt>
            <dd className="mt-1.5 font-mono text-[12.5px] text-text">{athlet ?? '–'}</dd>
          </div>
          <div>
            <dt className="marke text-[9px] text-text-schwach">Coach</dt>
            <dd
              className={`mt-1.5 font-mono text-[12.5px] ${
                coachZugang.art === 'da'
                  ? 'text-positiv'
                  : coachZugang.art === 'unbrauchbar'
                    ? 'text-negativ'
                    : 'text-text-schwach'
              }`}
            >
              {coachZugang.art === 'da'
                ? 'Token hinterlegt'
                : coachZugang.art === 'unbrauchbar'
                  ? 'Token unbrauchbar'
                  : 'Token fehlt'}
            </dd>
          </div>
          <div>
            <dt className="marke text-[9px] text-text-schwach">Abgleich</dt>
            <dd className="mt-1.5 font-mono text-[12.5px] text-text">
              {stand === null ? 'nie' : datumZeit(stand.zuletztAm)}
            </dd>
          </div>
        </dl>

        {stand?.fehler ? (
          <p className="mt-4 border-t border-kontur pt-3 font-mono text-[11px] leading-relaxed break-words text-negativ">
            {stand.fehler}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="text-[13.5px] text-text">Jetzt abgleichen</span>
          <AbgleichKnopf />
        </div>

        {coachZugang.art === 'da' ? null : (
          <p className="mt-4 border-t border-kontur pt-3 font-mono text-[11px] leading-relaxed text-text-leise">
            {coachZugang.art === 'unbrauchbar' ? `${coachZugang.grund}` : null}
            {coachZugang.art === 'fehlt'
              ? 'Der Coach läuft über das Claude-Code-Abo. Token erzeugen mit '
              : ' Neu erzeugen mit '}
            <code className="text-text-stark">claude setup-token</code>, in{' '}
            <code className="text-text-stark">.env</code> eintragen, Dienst neu
            starten.
          </p>
        )}

        <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-text-schwach">
          Schlüssel und Token stehen in der Datei <code>.env</code> auf dem
          Server und werden nie an den Browser gegeben.
        </p>
      </Kachel>

      <Kachel marke="Darstellung">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13.5px] text-text">Farbschema</span>
          <ThemaUmschalter />
        </div>
      </Kachel>
    </div>
  )
}
