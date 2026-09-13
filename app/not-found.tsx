import Link from 'next/link'

export const metadata = { title: 'Nicht gefunden — Takt' }

/**
 * Ohne diese Datei zeigt Next seine eigene Seite — auf Englisch. Der Auftrag
 * verlangt: keine Zeichenkette der Oberfläche auf Englisch.
 */
export default function NichtGefunden() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-grund px-4">
      <div className="w-full max-w-[420px] border border-kontur bg-flaeche p-8">
        <div className="marke text-[10px] text-text-schwach">Fehler 404</div>
        <h1 className="mt-3 text-[18px] font-semibold text-text-stark">
          Diese Seite gibt es nicht.
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-leise">
          Vielleicht wurde die Aktivität gelöscht, oder die Adresse stimmt nicht.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-[2px] bg-text-stark px-4 text-[14px] font-medium text-grund"
        >
          Zur Übersicht
        </Link>
      </div>
    </main>
  )
}
