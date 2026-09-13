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

/**
 * Kennungen. intervals.icu liefert sie mal als Zeichenkette, mal als Zahl —
 * Kalendereinträge etwa tragen numerische Kennungen. Ein reiner Textleser
 * gäbe dort `null` zurück und der ganze Plan bliebe leer.
 */
export function kennungOderNull(satz: Rohsatz, ...namen: string[]): string | null {
  for (const name of namen) {
    const wert = satz[name]
    if (typeof wert === 'string' && wert.trim() !== '') return wert.trim()
    if (typeof wert === 'number' && Number.isFinite(wert)) return String(wert)
  }
  return null
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
  const befuellt = new Map<string, number>()

  for (const satz of saetze) {
    for (const [name, wert] of Object.entries(satz)) {
      const leer =
        wert === null ||
        wert === undefined ||
        (typeof wert === 'string' && wert.trim() === '') ||
        (Array.isArray(wert) && wert.length === 0)
      if (!leer) befuellt.set(name, (befuellt.get(name) ?? 0) + 1)
      else if (!befuellt.has(name)) befuellt.set(name, 0)
    }
  }

  /*
   * `gesamt` ist die Zahl **aller** Sätze, nicht die Zahl der Sätze, in denen
   * der Schlüssel vorkam. Sonst meldete ein Feld, das in genau einem von 365
   * Tagen auftaucht, 1 von 1 und damit „immer befüllt" — und E0.8 bliebe
   * wirkungslos, weil nichts je als dauerhaft leer gälte.
   */
  const zaehler = new Map<string, { befuellt: number; gesamt: number }>()
  for (const [name, anzahl] of befuellt) {
    zaehler.set(name, { befuellt: anzahl, gesamt: saetze.length })
  }
  return zaehler
}
