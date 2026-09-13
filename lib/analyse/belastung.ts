/**
 * Kennzahlen, die intervals.icu nicht liefert und die Takt selbst rechnet.
 */

export interface Tagesbelastung {
  /** `YYYY-MM-DD` */
  tag: string
  belastung: number
}

export interface MonotonieErgebnis {
  /** Mittelwert der Tagesbelastung im Fenster. */
  mittel: number
  /** Standardabweichung der Tagesbelastung im Fenster. */
  streuung: number
  /**
   * Monotonie nach Foster: Mittelwert geteilt durch Streuung. `null`, wenn
   * die Streuung null ist — bei sieben gleichen Tagen ist die Monotonie nicht
   * definiert, und eine Division ergäbe Unendlich.
   */
  monotonie: number | null
  /** Wochenbelastung mal Monotonie. Das übliche Gegenstück. */
  belastungsdruck: number | null
  /** Summe der sieben Tage. */
  wochenbelastung: number
}

export const MONOTONIE_FENSTER = 7

function mittelwert(werte: readonly number[]): number {
  if (werte.length === 0) return 0
  return werte.reduce((a, b) => a + b, 0) / werte.length
}

/** Streuung der Grundgesamtheit, nicht der Stichprobe — das Fenster ist alles. */
function standardabweichung(werte: readonly number[], mittel: number): number {
  if (werte.length === 0) return 0
  const summe = werte.reduce((a, w) => a + (w - mittel) ** 2, 0)
  return Math.sqrt(summe / werte.length)
}

/**
 * Ruhetage zählen mit. Wer sieben Tage gleichmäßig belastet, hat eine hohe
 * Monotonie — genau das ist die Aussage der Kennzahl. Fehlende Tage werden
 * deshalb als null eingesetzt, nicht übersprungen.
 */
export function monotonie(
  tage: readonly Tagesbelastung[],
  bisTag: string,
  fenster = MONOTONIE_FENSTER,
): MonotonieErgebnis | null {
  const nachTag = new Map(tage.map((t) => [t.tag, t.belastung]))
  const ende = new Date(`${bisTag}T00:00:00Z`)
  if (Number.isNaN(ende.getTime())) return null

  const werte: number[] = []
  for (let i = fenster - 1; i >= 0; i -= 1) {
    const tag = new Date(ende)
    tag.setUTCDate(tag.getUTCDate() - i)
    const schluessel = tag.toISOString().slice(0, 10)
    werte.push(nachTag.get(schluessel) ?? 0)
  }

  const mittel = mittelwert(werte)
  const streuung = standardabweichung(werte, mittel)
  const wochenbelastung = werte.reduce((a, b) => a + b, 0)
  const wert = streuung === 0 ? null : mittel / streuung

  return {
    mittel,
    streuung,
    monotonie: wert,
    belastungsdruck: wert === null ? null : wochenbelastung * wert,
    wochenbelastung,
  }
}

export const RAMPE_WARNSCHWELLE = 5.0
export const RAMPE_TAGE = 28

export interface RampeErgebnis {
  /** Anstieg der Fitness je Woche über vier Wochen. */
  jeWoche: number
  /** Anstieg über den gesamten Zeitraum. */
  gesamt: number
  warnt: boolean
}

/**
 * Anstieg der Fitness über vier Wochen. CTL kommt fertig von intervals.icu
 * und wird nicht selbst gerechnet.
 *
 * Ausgegeben wird der Anstieg **je Woche**, weil die Warnschwelle 5,0 sich
 * darauf bezieht: mehr als fünf CTL-Punkte Zuwachs in einer Woche gilt als
 * zu schnell.
 */
export function rampe(vorherCtl: number, jetztCtl: number, tage = RAMPE_TAGE): RampeErgebnis | null {
  if (!Number.isFinite(vorherCtl) || !Number.isFinite(jetztCtl) || tage <= 0) return null
  const gesamt = jetztCtl - vorherCtl
  const jeWoche = (gesamt / tage) * 7
  return { jeWoche, gesamt, warnt: jeWoche > RAMPE_WARNSCHWELLE }
}

export interface Zonenanteil {
  zone: 1 | 2 | 3 | 4 | 5
  sekunden: number
  anteil: number
}

/**
 * Anteile der fünf Herzfrequenzzonen. Eingabe sind Sekunden je Zone.
 * Die Anteile summieren sich auf 1, sofern überhaupt Zeit anfiel.
 */
export function zonenanteile(sekundenJeZone: readonly number[]): Zonenanteil[] {
  const sauber = [0, 1, 2, 3, 4].map((i) => {
    const wert = sekundenJeZone[i]
    return typeof wert === 'number' && Number.isFinite(wert) && wert > 0 ? wert : 0
  })
  const gesamt = sauber.reduce((a, b) => a + b, 0)
  return sauber.map((sekunden, i) => ({
    zone: (i + 1) as 1 | 2 | 3 | 4 | 5,
    sekunden,
    anteil: gesamt === 0 ? 0 : sekunden / gesamt,
  }))
}
