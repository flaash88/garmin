'use client'

import { useEffect } from 'react'

/**
 * Auffangseite für Fehler beim Erzeugen einer Seite. Zeigt nie die
 * Einzelheiten — die stünden sonst im Browser und könnten Pfade oder
 * Verbindungszeichenketten verraten. Der Ausweis reicht, um den Fehler im
 * Serverprotokoll wiederzufinden.
 */
export default function Fehlerseite({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[takt] Fehler beim Erzeugen der Seite:', error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-grund px-4">
      <div className="w-full max-w-[420px] border border-kontur bg-flaeche p-8">
        <div className="flex items-center gap-[9px]">
          <span className="size-1.5 flex-none rounded-full bg-negativ" />
          <span className="marke text-[10px] text-negativ">Fehler</span>
        </div>
        <h1 className="mt-3 text-[18px] font-semibold text-text-stark">
          Diese Seite ließ sich nicht laden.
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-leise">
          Häufigste Ursache ist eine Datenbank, die gerade nicht erreichbar ist.
          Einzelheiten stehen im Serverprotokoll.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-text-schwach">
            Ausweis {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-[2px] bg-text-stark px-4 text-[14px] font-medium text-grund"
        >
          Erneut versuchen
        </button>
      </div>
    </main>
  )
}
