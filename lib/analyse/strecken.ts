/**
 * Wiederkehrende Strecken erkennen und Läufe zuordnen.
 *
 * Der Ansatz bewusst einfach: Läufe werden über eine grobe Signatur
 * verglichen — Start, Ziel, Länge und ein paar Stützpunkte dazwischen. Ein
 * echter Streckenvergleich mit Fréchet-Abstand wäre genauer und deutlich
 * teurer; für „das ist wieder die Runde am Fluss" reicht die Signatur.
 */

export interface Punkt {
  breite: number
  laenge: number
}

/** Erdradius in Metern. */
const ERDRADIUS = 6_371_000

export function abstand(a: Punkt, b: Punkt): number {
  const bog = Math.PI / 180
  const dBreite = (b.breite - a.breite) * bog
  const dLaenge = (b.laenge - a.laenge) * bog
  const m = a.breite * bog
  const n = b.breite * bog
  const h =
    Math.sin(dBreite / 2) ** 2 +
    Math.cos(m) * Math.cos(n) * Math.sin(dLaenge / 2) ** 2
  return 2 * ERDRADIUS * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const STUETZPUNKTE = 8

/**
 * Gleichmäßig über die **zurückgelegte Strecke** verteilte Stützpunkte, nicht
 * über den Index im Feld.
 *
 * Der Unterschied ist kein Feinschliff: Wer an einer Ampel stehen bleibt,
 * sammelt dort Dutzende fast gleicher Punkte. Nach Index gezogen rutschen
 * dadurch alle Stützpunkte zur Ampel hin, und dieselbe Runde erkennt sich
 * selbst nicht wieder. Nach Streckenlänge gezogen fällt eine Pause nicht ins
 * Gewicht.
 */
export function stuetzpunkte(spur: readonly Punkt[], anzahl = STUETZPUNKTE): Punkt[] {
  if (spur.length === 0) return []
  if (spur.length === 1) return Array.from({ length: anzahl }, () => spur[0] as Punkt)

  // Aufsummierte Strecke bis zu jedem Punkt.
  const bis: number[] = [0]
  for (let i = 1; i < spur.length; i += 1) {
    bis.push((bis[i - 1] ?? 0) + abstand(spur[i - 1] as Punkt, spur[i] as Punkt))
  }
  const gesamt = bis[bis.length - 1] ?? 0

  // Steht die Spur auf der Stelle, bleibt nur der Index.
  if (gesamt === 0) return Array.from({ length: anzahl }, () => spur[0] as Punkt)

  const ergebnis: Punkt[] = []
  let j = 1
  for (let i = 0; i < anzahl; i += 1) {
    const ziel = (i / (anzahl - 1)) * gesamt
    while (j < bis.length - 1 && (bis[j] ?? 0) < ziel) j += 1

    const vorher = bis[j - 1] ?? 0
    const nachher = bis[j] ?? 0
    const spanne = nachher - vorher
    const rest = spanne === 0 ? 0 : (ziel - vorher) / spanne

    const a = spur[j - 1] as Punkt
    const b = spur[j] as Punkt
    ergebnis.push({
      breite: a.breite + (b.breite - a.breite) * rest,
      laenge: a.laenge + (b.laenge - a.laenge) * rest,
    })
  }
  return ergebnis
}

export interface Signatur {
  punkte: Punkt[]
  laengeMeter: number
}

export function signatur(spur: readonly Punkt[], laengeMeter: number): Signatur {
  return { punkte: stuetzpunkte(spur), laengeMeter }
}

export interface Aehnlichkeit {
  /** Mittlerer Abstand der Stützpunkte in Metern. */
  mittlererAbstand: number
  /** Größter Abstand eines Stützpunkts in Metern. */
  groessterAbstand: number
  /** Längenunterschied als Anteil der kürzeren Strecke. */
  laengenunterschied: number
  gleich: boolean
}

/** Ab hier gelten zwei Läufe als dieselbe Strecke. */
export const GLEICH_MITTLERER_ABSTAND_M = 120
export const GLEICH_GROESSTER_ABSTAND_M = 250
export const GLEICH_LAENGENUNTERSCHIED = 0.1

/**
 * Vergleicht in beide Laufrichtungen. Dieselbe Runde andersherum gelaufen ist
 * dieselbe Runde.
 */
export function vergleichen(a: Signatur, b: Signatur): Aehnlichkeit | null {
  if (a.punkte.length !== b.punkte.length || a.punkte.length === 0) return null
  if (a.laengeMeter <= 0 || b.laengeMeter <= 0) return null

  const kuerzer = Math.min(a.laengeMeter, b.laengeMeter)
  const laengenunterschied = Math.abs(a.laengeMeter - b.laengeMeter) / kuerzer

  const abstaendeVorwaerts = a.punkte.map((p, i) => abstand(p, b.punkte[i] as Punkt))
  const umgedreht = [...b.punkte].reverse()
  const abstaendeRueckwaerts = a.punkte.map((p, i) => abstand(p, umgedreht[i] as Punkt))

  const mittel = (werte: number[]) => werte.reduce((x, y) => x + y, 0) / werte.length
  const besser =
    mittel(abstaendeVorwaerts) <= mittel(abstaendeRueckwaerts)
      ? abstaendeVorwaerts
      : abstaendeRueckwaerts

  const mittlererAbstand = mittel(besser)
  const groessterAbstand = Math.max(...besser)

  return {
    mittlererAbstand,
    groessterAbstand,
    laengenunterschied,
    gleich:
      mittlererAbstand <= GLEICH_MITTLERER_ABSTAND_M &&
      groessterAbstand <= GLEICH_GROESSTER_ABSTAND_M &&
      laengenunterschied <= GLEICH_LAENGENUNTERSCHIED,
  }
}

/**
 * Dünnt eine Spur auf höchstens `hoechstens` Punkte aus, ohne die Form zu
 * verlieren — gleichmäßig über die Strecke, Anfang und Ende bleiben liegen.
 *
 * Gedacht für den Weg zum Browser: eine Stunde Aufzeichnung sind schnell
 * über zehntausend Punkte. Die Karte zeigt davon ohnehin nur den Verlauf,
 * und die Zahlen der Aktivität kommen aus anderen Feldern.
 */
export function ausduennen(spur: readonly Punkt[], hoechstens = 1500): Punkt[] {
  if (spur.length <= hoechstens) return [...spur]
  return stuetzpunkte(spur, hoechstens)
}
