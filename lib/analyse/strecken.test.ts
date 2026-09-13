import { describe, expect, it } from 'vitest'
import { abstand, signatur, stuetzpunkte, vergleichen, type Punkt } from './strecken'

// Graz, Murufer. Ein Grad Breite sind rund 111 km.
const START: Punkt = { breite: 47.0707, laenge: 15.4395 }

function spur(punkte: number, versatzBreite = 0, versatzLaenge = 0): Punkt[] {
  return Array.from({ length: punkte }, (_, i) => ({
    breite: START.breite + i * 0.001 + versatzBreite,
    laenge: START.laenge + i * 0.0005 + versatzLaenge,
  }))
}

describe('abstand', () => {
  it('ist null fuer denselben Punkt', () => {
    expect(abstand(START, START)).toBe(0)
  })

  it('trifft ein Grad Breite auf etwa 111 km', () => {
    const weiter = { breite: START.breite + 1, laenge: START.laenge }
    expect(abstand(START, weiter)).toBeGreaterThan(110_000)
    expect(abstand(START, weiter)).toBeLessThan(112_000)
  })

  it('ist symmetrisch', () => {
    const b = { breite: 47.1, laenge: 15.5 }
    expect(abstand(START, b)).toBeCloseTo(abstand(b, START), 6)
  })
})

describe('stuetzpunkte', () => {
  it('gibt immer die verlangte Anzahl zurueck, egal wie dicht die Rohpunkte liegen', () => {
    expect(stuetzpunkte(spur(500))).toHaveLength(8)
    expect(stuetzpunkte(spur(9))).toHaveLength(8)
  })

  it('behaelt Anfang und Ende bei', () => {
    const s = spur(100)
    const p = stuetzpunkte(s)
    expect(p[0]?.breite).toBeCloseTo(s[0]?.breite ?? 0, 9)
    expect(p[7]?.breite).toBeCloseTo(s[99]?.breite ?? 0, 9)
  })

  it('verteilt nach Streckenlaenge, nicht nach Index', () => {
    // Der Ampel-Fall: dieselbe Runde, einmal mit 60 fast gleichen Punkten an
    // einer Stelle in der Mitte. Nach Index gezogen rutschten alle
    // Stuetzpunkte zur Ampel hin und die Runde erkennt sich nicht wieder.
    const glatt = spur(120)
    const halt = glatt[60] as Punkt
    const mitAmpel = [
      ...glatt.slice(0, 60),
      ...Array.from({ length: 60 }, () => ({ ...halt })),
      ...glatt.slice(60),
    ]

    const a = stuetzpunkte(glatt)
    const b = stuetzpunkte(mitAmpel)
    const groesster = Math.max(...a.map((p, i) => abstand(p, b[i] as Punkt)))
    expect(groesster).toBeLessThan(50)
  })

  it('erkennt dieselbe Runde trotz einer Pause unterwegs', () => {
    const glatt = spur(120)
    const halt = glatt[60] as Punkt
    const mitAmpel = [
      ...glatt.slice(0, 60),
      ...Array.from({ length: 60 }, () => ({ ...halt })),
      ...glatt.slice(60),
    ]
    const e = vergleichen(signatur(glatt, 10_000), signatur(mitAmpel, 10_000))
    expect(e?.gleich).toBe(true)
  })

  it('haelt eine Spur aus, die auf der Stelle steht', () => {
    const stehend = Array.from({ length: 20 }, () => ({ ...START }))
    expect(stuetzpunkte(stehend)).toHaveLength(8)
  })

  it('haelt eine leere und eine einpunktige Spur aus', () => {
    expect(stuetzpunkte([])).toEqual([])
    expect(stuetzpunkte([START])).toHaveLength(8)
  })
})

describe('vergleichen', () => {
  it('erkennt denselben Lauf als dieselbe Strecke', () => {
    const a = signatur(spur(200), 10_000)
    expect(vergleichen(a, a)?.gleich).toBe(true)
  })

  it('erkennt dieselbe Runde trotz kleiner Abweichung im GPS', () => {
    const a = signatur(spur(200), 10_000)
    // Rund 55 m Versatz — innerhalb dessen, was GPS streut.
    const b = signatur(spur(200, 0.0005), 10_150)
    expect(vergleichen(a, b)?.gleich).toBe(true)
  })

  it('erkennt dieselbe Runde andersherum gelaufen', () => {
    const a = signatur(spur(200), 10_000)
    const b = signatur([...spur(200)].reverse(), 10_000)
    expect(vergleichen(a, b)?.gleich).toBe(true)
  })

  it('trennt eine andere Strecke ab', () => {
    const a = signatur(spur(200), 10_000)
    // Ein halbes Grad Breite weiter, das sind ueber 50 km.
    const b = signatur(spur(200, 0.5), 10_000)
    expect(vergleichen(a, b)?.gleich).toBe(false)
  })

  it('trennt dieselbe Gegend bei deutlich anderer Laenge ab', () => {
    // Ohne die Laengenpruefung wuerde eine kurze Runde als eine lange
    // durchgehen, solange die Stuetzpunkte zufaellig nahe liegen.
    const a = signatur(spur(200), 10_000)
    const b = signatur(spur(200), 14_000)
    const e = vergleichen(a, b)
    expect(e?.mittlererAbstand).toBeLessThan(120)
    expect(e?.laengenunterschied).toBeGreaterThan(0.1)
    expect(e?.gleich).toBe(false)
  })

  it('gibt null zurueck, wenn eine Signatur unbrauchbar ist', () => {
    expect(vergleichen(signatur([], 0), signatur(spur(10), 5000))).toBeNull()
    expect(vergleichen(signatur(spur(10), 0), signatur(spur(10), 5000))).toBeNull()
  })
})
