/**
 * Streuung und Güte von Intervall-Splits.
 *
 * Die Frage dahinter: Wurden die Wiederholungen gleichmäßig gelaufen, und
 * trafen sie das Ziel? Beides ist getrennt zu beurteilen — gleichmäßig zu
 * langsam ist etwas anderes als ungleichmäßig um das Ziel herum.
 */

export interface Split {
  /** Dauer der Wiederholung in Sekunden. */
  sekunden: number
  /** Strecke in Metern. */
  meter: number
}

export interface SplitGuete {
  anzahl: number
  /** Pace je Wiederholung in Sekunden je Kilometer. */
  paces: number[]
  mittelPace: number
  /** Standardabweichung der Pace in Sekunden je Kilometer. */
  streuung: number
  /**
   * Streuung geteilt durch Mittelwert. Vergleichbar über verschiedene
   * Geschwindigkeiten hinweg — 2 s Streuung sind bei 3:00/km viel, bei
   * 6:00/km wenig.
   */
  streuungsmass: number
  /** Schnellste und langsamste Wiederholung, in Sekunden je Kilometer. */
  schnellste: number
  langsamste: number
  /** Differenz zwischen langsamster und schnellster Wiederholung. */
  spanne: number
  /**
   * Abweichung vom Ziel in Sekunden je Kilometer, positiv heißt langsamer.
   * `null`, wenn kein Ziel angegeben wurde.
   */
  zielabweichung: number | null
}

export function splitGuete(
  splits: readonly Split[],
  zielPace?: number,
): SplitGuete | null {
  const paces = splits
    .filter((s) => s.sekunden > 0 && s.meter > 0)
    .map((s) => (s.sekunden / s.meter) * 1000)

  if (paces.length < 2) return null

  const mittel = paces.reduce((a, b) => a + b, 0) / paces.length
  const streuung = Math.sqrt(
    paces.reduce((a, p) => a + (p - mittel) ** 2, 0) / paces.length,
  )
  const schnellste = Math.min(...paces)
  const langsamste = Math.max(...paces)

  return {
    anzahl: paces.length,
    paces,
    mittelPace: mittel,
    streuung,
    streuungsmass: mittel === 0 ? 0 : streuung / mittel,
    schnellste,
    langsamste,
    spanne: langsamste - schnellste,
    zielabweichung:
      zielPace === undefined || !Number.isFinite(zielPace) ? null : mittel - zielPace,
  }
}

/**
 * Sind die Wiederholungen nach hinten raus langsamer geworden? Gibt die
 * Steigung einer Ausgleichsgeraden über die Pace zurück, in Sekunden je
 * Kilometer und Wiederholung. Positiv heißt: es wurde langsamer.
 */
export function verfall(splits: readonly Split[]): number | null {
  const paces = splits
    .filter((s) => s.sekunden > 0 && s.meter > 0)
    .map((s) => (s.sekunden / s.meter) * 1000)
  if (paces.length < 3) return null

  const n = paces.length
  const mittelX = (n - 1) / 2
  const mittelY = paces.reduce((a, b) => a + b, 0) / n

  let zaehler = 0
  let nenner = 0
  for (let i = 0; i < n; i += 1) {
    zaehler += (i - mittelX) * ((paces[i] ?? 0) - mittelY)
    nenner += (i - mittelX) ** 2
  }
  return nenner === 0 ? null : zaehler / nenner
}
