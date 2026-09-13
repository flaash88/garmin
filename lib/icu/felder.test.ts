import { describe, expect, it } from 'vitest'
import { befuellungZaehlen, kennungOderNull } from './felder'

describe('kennungOderNull', () => {
  it('nimmt eine Kennung als Zeichenkette', () => {
    expect(kennungOderNull({ id: 'i4711' }, 'id')).toBe('i4711')
  })

  it('nimmt eine Kennung auch als Zahl', () => {
    // Kalendereintraege von intervals.icu tragen numerische Kennungen.
    // Ein reiner Textleser gaebe hier null und der Plan bliebe leer.
    expect(kennungOderNull({ id: 98765 }, 'id')).toBe('98765')
  })

  it('gibt null bei fehlender oder leerer Kennung', () => {
    expect(kennungOderNull({}, 'id')).toBeNull()
    expect(kennungOderNull({ id: '   ' }, 'id')).toBeNull()
    expect(kennungOderNull({ id: Number.NaN }, 'id')).toBeNull()
  })
})

describe('befuellungZaehlen', () => {
  it('zaehlt gesamt ueber alle Saetze, nicht nur ueber die mit dem Schluessel', () => {
    // Der entscheidende Fall: 'ausreisser' kommt in genau einem von vier
    // Saetzen vor. Frueher meldete das 1 von 1 und damit 'immer befuellt' —
    // und E0.8 haette nie ein Feld ausgeblendet.
    const zaehler = befuellungZaehlen([
      { ruhepuls: 44 },
      { ruhepuls: 43 },
      { ruhepuls: 45, ausreisser: 'einmalig' },
      { ruhepuls: 44 },
    ])
    expect(zaehler.get('ruhepuls')).toEqual({ befuellt: 4, gesamt: 4 })
    expect(zaehler.get('ausreisser')).toEqual({ befuellt: 1, gesamt: 4 })
  })

  it('erkennt ein dauerhaft leeres Feld', () => {
    const zaehler = befuellungZaehlen([
      { hauttemperatur: null, atemfrequenz: null, ruhepuls: 44 },
      { hauttemperatur: null, atemfrequenz: null, ruhepuls: 43 },
    ])
    expect(zaehler.get('hauttemperatur')).toEqual({ befuellt: 0, gesamt: 2 })
    expect(zaehler.get('atemfrequenz')).toEqual({ befuellt: 0, gesamt: 2 })
    expect(zaehler.get('ruhepuls')?.befuellt).toBe(2)
  })

  it('behandelt leere Zeichenketten und leere Listen als nicht befuellt', () => {
    const zaehler = befuellungZaehlen([{ notiz: '  ', laps: [], wert: 0 }])
    expect(zaehler.get('notiz')?.befuellt).toBe(0)
    expect(zaehler.get('laps')?.befuellt).toBe(0)
    // Die Zahl null ist ein Wert, kein fehlender Wert.
    expect(zaehler.get('wert')?.befuellt).toBe(1)
  })
})
