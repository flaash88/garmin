import { describe, expect, it } from 'vitest'
import {
  grenzenBrauchbar,
  sekundenJeZone,
  zoneFuerPuls,
  zonenAusPulsreihe,
} from './zonen'

/** Die echten Laufgrenzen: lthr 165, max 196, sieben Obergrenzen. */
const LAUF = [130, 148, 162, 177, 184, 192, 196]
/** Und die Radgrenzen desselben Athleten — deutlich höher. */
const RAD = [161, 179, 187, 199, 205, 211, 220]

describe('zoneFuerPuls', () => {
  it('ordnet an den Grenzen nach unten ein', () => {
    // Die Grenze gehört zu ihrer Zone, nicht zur nächsten.
    expect(zoneFuerPuls(130, LAUF)).toBe(1)
    expect(zoneFuerPuls(131, LAUF)).toBe(2)
    expect(zoneFuerPuls(148, LAUF)).toBe(2)
    expect(zoneFuerPuls(149, LAUF)).toBe(3)
  })

  it('zaehlt einen Ausreisser ueber dem Maximalpuls in die hoechste Zone', () => {
    // Verschwinden darf er nicht — er ist der härteste Moment der Einheit.
    expect(zoneFuerPuls(201, LAUF)).toBe(7)
  })

  it('gibt bei unbrauchbaren Werten null zurueck', () => {
    expect(zoneFuerPuls(0, LAUF)).toBeNull()
    expect(zoneFuerPuls(-5, LAUF)).toBeNull()
    expect(zoneFuerPuls(Number.NaN, LAUF)).toBeNull()
    expect(zoneFuerPuls(150, [])).toBeNull()
  })

  it('ordnet denselben Puls je nach Sportart anders ein', () => {
    // Der ganze Zweck der Zuordnung: 170 ist im Lauf Zone 4, auf dem Rad
    // Zone 2. Eine Laufeinheit gegen die Radgrenzen zu rechnen ergaebe
    // Zahlen, die ueberall danebenliegen.
    expect(zoneFuerPuls(170, LAUF)).toBe(4)
    expect(zoneFuerPuls(170, RAD)).toBe(2)
  })
})

describe('sekundenJeZone', () => {
  it('zaehlt je Messpunkt eine Sekunde', () => {
    const reihe = [120, 120, 140, 170, 170, 170]
    expect(sekundenJeZone(reihe, LAUF)).toEqual([2, 1, 0, 3, 0, 0, 0])
  })

  it('nimmt einen anderen Messabstand an', () => {
    expect(sekundenJeZone([120, 120], LAUF, 5)).toEqual([10, 0, 0, 0, 0, 0, 0])
  })

  it('ueberspringt Luecken in der Reihe, statt sie als null zu zaehlen', () => {
    const reihe = [120, null, undefined, 'x', 140]
    expect(sekundenJeZone(reihe, LAUF)).toEqual([1, 1, 0, 0, 0, 0, 0])
  })

  it('liefert so viele Eimer wie Grenzen', () => {
    expect(sekundenJeZone([150], LAUF)).toHaveLength(7)
    expect(sekundenJeZone([150], [160, 180])).toHaveLength(2)
  })
})

describe('zonenAusPulsreihe', () => {
  it('summiert die Anteile auf eins', () => {
    const a = zonenAusPulsreihe([120, 140, 170, 170], LAUF)
    expect(a).toHaveLength(7)
    expect(a.reduce((s, z) => s + z.anteil, 0)).toBeCloseTo(1, 9)
  })

  it('gibt ohne Grenzen nichts zurueck, statt fuenf leere Zonen zu erfinden', () => {
    expect(zonenAusPulsreihe([120, 140], [])).toEqual([])
  })

  it('haelt eine Reihe ohne brauchbare Werte aus', () => {
    const a = zonenAusPulsreihe([null, 'x'], LAUF)
    expect(a.every((z) => z.anteil === 0)).toBe(true)
  })
})

describe('grenzenBrauchbar', () => {
  it('nimmt aufsteigende, positive Grenzen an', () => {
    expect(grenzenBrauchbar(LAUF)).toBe(true)
  })

  it('weist lauter Nullen ab', () => {
    // Eine Sportartgruppe, die nie eingerichtet wurde. Ungeprueft ergaebe
    // das eine Kachel mit «100 % Z7» und «≤0» — eine Aussage ueber nichts.
    expect(grenzenBrauchbar([0, 0, 0, 0, 0, 0, 0])).toBe(false)
    expect(zonenAusPulsreihe([150, 150], [0, 0, 0])).toEqual([])
  })

  it('weist absteigende und gleiche Grenzen ab', () => {
    expect(grenzenBrauchbar([130, 120])).toBe(false)
    expect(grenzenBrauchbar([130, 130])).toBe(false)
  })

  it('weist eine leere Liste ab', () => {
    expect(grenzenBrauchbar([])).toBe(false)
  })
})
