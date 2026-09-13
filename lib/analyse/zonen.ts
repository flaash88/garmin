import { zonenanteile, type Zonenanteil } from './belastung'

/**
 * Herzfrequenzzonen einer Einheit — gegen die Grenzen **ihrer** Sportart.
 *
 * intervals.icu führt Schwellen und Grenzen je Sportartgruppe. Rad- und
 * Laufwerte gehen auseinander; eine Laufeinheit gegen die Radgrenzen zu
 * rechnen ergäbe Zahlen, die überall danebenliegen. Wer hier rechnet, gibt
 * deshalb die Grenzen mit, statt sie zu erraten.
 */

/**
 * In welche Zone ein Pulswert fällt. Eins-basiert.
 *
 * `grenzen` sind **Obergrenzen**, aufsteigend: `[130, 148, 162, …]` heißt
 * Zone 1 bis 130, Zone 2 bis 148, und so fort. Was über der letzten Grenze
 * liegt, zählt in die letzte Zone — ein Ausreißer über den Maximalpuls
 * hinaus darf nicht verschwinden.
 */
/**
 * Ob die Grenzen überhaupt Zonen beschreiben: positiv und streng aufsteigend.
 *
 * Für eine Sportartgruppe, die nie eingerichtet wurde, liefert intervals.icu
 * auch `[0, 0, 0, …]`. Ungeprüft ergäbe das eine Kachel mit «100 % Z7» und
 * Beschriftungen wie «≤0» und «1–0» — eine Aussage über nichts. Besser gar
 * keine Kachel.
 */
export function grenzenBrauchbar(grenzen: readonly number[]): boolean {
  if (grenzen.length === 0) return false
  let vorige = 0
  for (const grenze of grenzen) {
    if (!Number.isFinite(grenze) || grenze <= vorige) return false
    vorige = grenze
  }
  return true
}

export function zoneFuerPuls(puls: number, grenzen: readonly number[]): number | null {
  if (!Number.isFinite(puls) || puls <= 0 || !grenzenBrauchbar(grenzen)) return null
  for (let i = 0; i < grenzen.length; i += 1) {
    const grenze = grenzen[i]
    if (grenze !== undefined && puls <= grenze) return i + 1
  }
  return grenzen.length
}

/** Sekunden je Zone aus einer Pulsreihe. */
export function sekundenJeZone(
  pulsreihe: readonly unknown[],
  grenzen: readonly number[],
  /** Abstand zweier Messpunkte. intervals.icu liefert im Sekundentakt. */
  sekundenJePunkt = 1,
): number[] {
  const eimer = Array.from({ length: grenzen.length }, () => 0)
  for (const wert of pulsreihe) {
    if (typeof wert !== 'number') continue
    const zone = zoneFuerPuls(wert, grenzen)
    if (zone === null) continue
    eimer[zone - 1] = (eimer[zone - 1] ?? 0) + sekundenJePunkt
  }
  return eimer
}

/** Anteile je Zone aus einer Pulsreihe und den Grenzen der Sportart. */
export function zonenAusPulsreihe(
  pulsreihe: readonly unknown[],
  grenzen: readonly number[],
  sekundenJePunkt = 1,
): Zonenanteil[] {
  if (!grenzenBrauchbar(grenzen)) return []
  return zonenanteile(sekundenJeZone(pulsreihe, grenzen, sekundenJePunkt), grenzen.length)
}
