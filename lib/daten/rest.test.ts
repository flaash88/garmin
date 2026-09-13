import { describe, expect, it } from 'vitest'
import { spalteZeigen } from './rest'

type Stand = Map<string, { befuellt: number; gesamt: number }>

function stand(eintraege: Record<string, [number, number]>): Stand {
  return new Map(
    Object.entries(eintraege).map(([f, [b, g]]) => [f, { befuellt: b, gesamt: g }]),
  )
}

describe('spalteZeigen', () => {
  it('zeigt alles, solange nichts festgehalten ist', () => {
    expect(spalteZeigen(new Map(), ['sleepSecs', 'sleepHours'])).toBe(true)
  })

  it('blendet ein Feld aus, das nie befuellt war', () => {
    expect(spalteZeigen(stand({ skinTemp: [0, 365] }), ['skinTemp'])).toBe(false)
  })

  it('zeigt ein Feld, das wenigstens einmal befuellt war', () => {
    expect(spalteZeigen(stand({ hrv: [1, 365] }), ['hrv'])).toBe(true)
  })

  it('uebergeht Feldnamen, die nie geschickt wurden', () => {
    // Der eigentliche Fehler: 'sleepHours' kommt in der Tabelle gar nicht
    // vor, weil intervals.icu nur 'sleepSecs' schickt. Frueher verlangte
    // die Pruefung, dass ALLE Namen als leer eingetragen sind — und weil
    // 'sleepHours' fehlte, war die Spalte nie auszublenden.
    expect(spalteZeigen(stand({ sleepSecs: [0, 365] }), ['sleepSecs', 'sleepHours']))
      .toBe(false)
  })

  it('zeigt die Spalte, wenn einer von mehreren Namen traegt', () => {
    expect(
      spalteZeigen(stand({ sleepSecs: [0, 365], sleepHours: [200, 365] }), [
        'sleepSecs',
        'sleepHours',
      ]),
    ).toBe(true)
  })

  it('zeigt die Spalte, wenn keiner ihrer Namen vorkam', () => {
    // Nichts gewusst heisst nicht 'leer'.
    expect(spalteZeigen(stand({ hrv: [365, 365] }), ['mood', 'feel'])).toBe(true)
  })

  it('uebergeht Eintraege ohne Saetze', () => {
    expect(spalteZeigen(stand({ hrv: [0, 0] }), ['hrv'])).toBe(true)
  })
})
