import { ThemaUmschalter } from '@/komponenten/thema-umschalter'

/**
 * Vollständig ausgeschriebene Klassennamen. Tailwind liest den Quelltext als
 * Text; ein zusammengesetztes `bg-${name}` erzeugt keine Regel und die Kachel
 * bliebe leer. Siehe DECISIONS.md, E1.3.
 */
const FARBEN: ReadonlyArray<readonly [string, string]> = [
  ['grund', 'bg-grund'],
  ['flaeche', 'bg-flaeche'],
  ['flaeche-2', 'bg-flaeche-2'],
  ['kontur', 'bg-kontur'],
  ['kontur-stark', 'bg-kontur-stark'],
  ['text-stark', 'bg-text-stark'],
  ['text', 'bg-text'],
  ['text-leise', 'bg-text-leise'],
  ['text-schwach', 'bg-text-schwach'],
  ['akzent', 'bg-akzent'],
  ['akzent-flaeche', 'bg-akzent-flaeche'],
  ['akzent-kontur', 'bg-akzent-kontur'],
  ['positiv', 'bg-positiv'],
  ['warnung', 'bg-warnung'],
  ['negativ', 'bg-negativ'],
  ['zone-1', 'bg-zone-1'],
  ['zone-2', 'bg-zone-2'],
  ['zone-3', 'bg-zone-3'],
  ['zone-4', 'bg-zone-4'],
  ['zone-5', 'bg-zone-5'],
]

export default function Startseite() {
  return (
    <main className="min-h-dvh bg-grund px-5 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-[19px] font-semibold tracking-[0.2em] text-text-stark">TAKT</div>
          <div className="marke mt-2 text-[10px] text-text-schwach">Laufanalyse</div>
        </div>
        <ThemaUmschalter />
      </header>

      <section className="border border-kontur bg-flaeche p-5">
        <h1 className="marke mb-4 text-[10px] text-text-schwach">Gerüst steht — Phase 1</h1>
        <p className="max-w-prose text-sm leading-relaxed text-text">
          Die Farben stammen unverändert aus <code className="font-mono text-xs">design/Takt.dc.html</code>.
          Der Umschalter oben setzt <code className="font-mono text-xs">data-thema</code> am
          Wurzelelement und merkt sich die Wahl. Die Seiten des Entwurfs kommen in Phase 4.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-px border border-kontur bg-kontur sm:grid-cols-4">
          {FARBEN.map(([name, klasse]) => (
            <div key={name} className="bg-flaeche p-3">
              <div className={`h-10 border border-kontur ${klasse}`} />
              <div className="marke mt-2 text-[9px] text-text-schwach">{name}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
