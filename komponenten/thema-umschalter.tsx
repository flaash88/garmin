'use client'

import { useEffect, useState } from 'react'
import { gegenthema, istThema, THEMA_SCHLUESSEL, type Thema } from '@/lib/thema'
import { SymbolMond, SymbolSonne } from './symbole'

export function ThemaUmschalter() {
  const [thema, setThema] = useState<Thema | null>(null)

  useEffect(() => {
    const gesetzt = document.documentElement.getAttribute('data-thema')
    setThema(istThema(gesetzt) ? gesetzt : 'hell')
  }, [])

  function wechseln() {
    const neu = gegenthema(thema ?? 'hell')
    document.documentElement.setAttribute('data-thema', neu)
    try {
      localStorage.setItem(THEMA_SCHLUESSEL, neu)
    } catch {
      /* Speicher gesperrt — die Wahl gilt dann nur für diese Sitzung. */
    }
    setThema(neu)
  }

  /*
   * Symbol statt Text: bei Hell zeigt der Knopf den Mond — er sagt, wohin es
   * geht, nicht wo man ist. Vor dem ersten Effekt ist die Wahl unbekannt; dann
   * bleibt der Knopf leer, damit nichts aufblitzt und nichts springt.
   */
  const beschriftung =
    thema === null
      ? 'Farbschema wechseln'
      : thema === 'hell'
        ? 'Auf dunkles Farbschema wechseln'
        : 'Auf helles Farbschema wechseln'

  return (
    <button
      type="button"
      onClick={wechseln}
      aria-label={beschriftung}
      title={beschriftung}
      className="flex size-[34px] min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[2px] border border-kontur bg-flaeche text-text-leise md:min-h-[34px] md:min-w-[34px] hover:border-kontur-stark hover:text-text-stark"
    >
      {thema === null ? null : thema === 'hell' ? <SymbolMond /> : <SymbolSonne />}
    </button>
  )
}
