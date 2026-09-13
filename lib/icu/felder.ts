/**
 * Defensive Leser für Antworten von intervals.icu.
 *
 * Ohne echten Zugang lässt sich die genaue Form nicht festnageln, und die API
 * benennt manche Werte je nach Endpunkt verschieden. Diese Leser nehmen
 * mehrere Namen entgegen und geben `null`, wenn keiner trägt — statt zu
 * werfen oder stillschweigend `0` zu liefern. Der Unterschied zwischen „nicht
 * geliefert" und „ist null" bleibt damit erhalten; Phase 4 blendet leere
 * Felder aus, statt einen Strich zu zeigen.
 */

export type Rohsatz = Record<string, unknown>

export function istSatz(wert: unknown): wert is Rohsatz {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert)
}

export function zahlOderNull(satz: Rohsatz, ...namen: string[]): number | null {
  for (const name of namen) {
    const wert = satz[name]
    if (typeof wert === 'number' && Number.isFinite(wert)) return wert
    if (typeof wert === 'string' && wert.trim() !== '') {
      const gewandelt = Number(wert)
      if (Number.isFinite(gewandelt)) return gewandelt
    }
  }
  return null
}

export function ganzzahlOderNull(satz: Rohsatz, ...namen: string[]): number | null {
  const wert = zahlOderNull(satz, ...namen)
  return wert === null ? null : Math.round(wert)
}

export function textOderNull(satz: Rohsatz, ...namen: string[]): string | null {
  for (const name of namen) {
    const wert = satz[name]
    if (typeof wert === 'string' && wert.trim() !== '') return wert.trim()
  }
  return null
}

/** Gibt `YYYY-MM-DD` zurück, auch wenn ein voller Zeitstempel ankam. */
export function tagOderNull(satz: Rohsatz, ...namen: string[]): string | null {
  const text = textOderNull(satz, ...namen)
  if (!text) return null
  const treffer = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  return treffer?.[1] ?? null
}

export function zeitpunktOderNull(satz: Rohsatz, ...namen: string[]): Date | null {
  const text = textOderNull(satz, ...namen)
  if (!text) return null
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Zählt je Feldname, wie oft ein Wert ankam, der nicht leer ist. Grundlage für
 * die Entscheidung aus E0.8: Felder, die über den gesamten Erstbestand leer
 * bleiben, werden in der Oberfläche ausgeblendet statt mit einem Strich
 * gezeigt.
 */
export function befuellungZaehlen(
  saetze: readonly Rohsatz[],
): Map<string, { befuellt: number; gesamt: number }> {
  const zaehler = new Map<string, { befuellt: number; gesamt: number }>()
  for (const satz of saetze) {
    for (const [name, wert] of Object.entries(satz)) {
      const stand = zaehler.get(name) ?? { befuellt: 0, gesamt: 0 }
      stand.gesamt += 1
      const leer =
        wert === null ||
        wert === undefined ||
        (typeof wert === 'string' && wert.trim() === '') ||
        (Array.isArray(wert) && wert.length === 0)
      if (!leer) stand.befuellt += 1
      zaehler.set(name, stand)
    }
  }
  return zaehler
}
