'use client'

import { useEffect, useState } from 'react'
import { datum, wann } from '@/lib/format'

/**
 * «heute, 19:14» — aber erst, nachdem der Browser übernommen hat.
 *
 * «heute» und «gestern» hängen an der Uhr und der Zeitzone des Betrachters.
 * Der Server kennt beide nicht: seine Zeitzone kommt aus `TZ` im Behälter,
 * und zwischen seiner Darstellung und dem Aufbau im Browser kann Mitternacht
 * liegen. Beides führte zu einer Abweichung beim Andocken.
 *
 * Serverseitig steht deshalb das schlichte Datum, das sich rein aus der
 * Zeichenkette ergibt — auf beiden Seiten gleich. Nach dem ersten Effekt
 * ersetzt der Browser es durch die Fassung, die seine Uhr hergibt.
 */
export function Zeitmarke({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    setText(wann(new Date(iso)))
  }, [iso])

  return <span className={className}>{text ?? datum(iso.slice(0, 10))}</span>
}
