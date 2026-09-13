'use client'

import { useEffect, useState } from 'react'
import { gegenthema, istThema, THEMA_SCHLUESSEL, type Thema } from '@/lib/thema'

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

  // Vor dem ersten Effekt ist die Wahl unbekannt. Platz freihalten, damit
  // nichts springt, aber keine falsche Beschriftung zeigen.
  const beschriftung = thema === null ? '' : thema === 'hell' ? 'Dunkel' : 'Hell'

  return (
    <button
      type="button"
      onClick={wechseln}
      aria-label="Farbschema wechseln"
      className="marke min-h-11 min-w-11 cursor-pointer rounded-xs border border-kontur bg-flaeche px-3 text-[10px] text-text-leise hover:border-kontur-stark hover:text-text-stark"
    >
      {beschriftung}
    </button>
  )
}
