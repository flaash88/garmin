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
 * Gleichmäßig verteilte Stützpunkte über den Streckenverlauf. Unabhängig
 * davon, wie dicht die Rohpunkte liegen.
 */
export function stuetzpunkte(spur: readonly Punkt[], anzahl = STUETZPUNKTE): Punkt[] {
  if (spur.length === 0) return []
  if (spur.length === 1) return Array.from({ length: anzahl }, () => spur[0] as Punkt)

  const ergebnis: Punkt[] = []
  for (let i = 0; i < anzahl; i += 1) {
    const stelle = (i / (anzahl - 1)) * (spur.length - 1)
    const unten = Math.floor(stelle)
    const oben = Math.min(unten + 1, spur.length - 1)
    const rest = stelle - unten
    const a = spur[unten] as Punkt
    const b = spur[oben] as Punkt
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
