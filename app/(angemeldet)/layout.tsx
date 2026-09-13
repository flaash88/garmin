import Link from 'next/link'
import { Seitenleiste, Unterleiste } from '@/komponenten/navigation'
import { Kopfzeile } from '@/komponenten/kopfzeile'

/**
 * Alles hinter der Anmeldung wird bei jeder Anfrage erzeugt. Die Kopfzeile
 * liest den Stand des Abgleichs aus der Datenbank; ohne diese Zeile versuchte
 * `next build` die Seiten vorab zu erzeugen und bräuchte dafür eine laufende
 * Datenbank.
 */
export const dynamic = 'force-dynamic'

/**
 * Rahmen für alles hinter der Anmeldung.
 *
 * Schreibtisch: feste linke Leiste, 260 px. Telefon: untere Leiste mit fünf
 * Einträgen. Der Inhalt hält unten Platz frei, damit die Leiste nichts
 * verdeckt — Safe-Area-Inset eingerechnet.
 */
export default function AngemeldetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-grund text-text">
      <aside className="hidden w-[260px] flex-none flex-col border-r border-kontur bg-flaeche pt-[22px] pb-4 md:flex">
        <div className="px-5 pb-5">
          <Link href="/" className="block">
            <div className="text-[19px] leading-none font-semibold tracking-[0.2em] text-text-stark">
              TAKT
            </div>
            <div className="marke mt-2 text-[10px] leading-none tracking-[0.1em] text-text-schwach">
              Laufanalyse
            </div>
          </Link>
        </div>

        <Seitenleiste />

        <div className="mt-auto border-t border-kontur px-5 pt-4 font-mono text-[11px] leading-[1.6] text-text-schwach">
          Schlaf, HRV und Ruhepuls
          <br />
          kommen aus der Uhr über
          <br />
          intervals.icu.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden md:block">
          <Kopfzeile />
        </div>

        {/* Unten Platz für die Leiste am Telefon: 50 px plus Safe Area. */}
        <main className="min-w-0 flex-1 pb-[calc(50px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <Unterleiste />
    </div>
  )
}
