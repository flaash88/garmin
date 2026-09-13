import { describe, expect, it } from 'vitest'
import { icuNutzlast, nutzlastText, type Vorschlagseinheit } from './nutzlast'

const EINHEIT: Vorschlagseinheit = {
  tag: '2026-09-16',
  name: '5 × 1000 m',
  typ: 'Run',
  beschreibung: 'Zielpace 3:45, Trabpause 2:30',
  dauerSekunden: 3600,
  streckeMeter: 12000,
  zielBelastung: 78,
}

describe('icuNutzlast', () => {
  it('setzt Kategorie, Datum, Typ und Name', () => {
    const n = icuNutzlast(EINHEIT)
    expect(n.category).toBe('WORKOUT')
    expect(n.start_date_local).toBe('2026-09-16T00:00:00')
    expect(n.type).toBe('Run')
    expect(n.name).toBe('5 × 1000 m')
  })

  it('uebernimmt Beschreibung, Dauer, Strecke und Belastung', () => {
    const n = icuNutzlast(EINHEIT)
    expect(n.description).toBe('Zielpace 3:45, Trabpause 2:30')
    expect(n.moving_time).toBe(3600)
    expect(n.distance).toBe(12000)
    expect(n.icu_training_load).toBe(78)
  })

  it('laesst leere Felder weg, statt sie auf null zu setzen', () => {
    const n = icuNutzlast({
      ...EINHEIT,
      beschreibung: null,
      dauerSekunden: null,
      streckeMeter: null,
      zielBelastung: null,
    })
    expect('description' in n).toBe(false)
    expect('moving_time' in n).toBe(false)
    expect('distance' in n).toBe(false)
    expect('icu_training_load' in n).toBe(false)
  })

  it('laesst auch die Null weg — eine Zieldauer von 0 waere eine Behauptung', () => {
    const n = icuNutzlast({ ...EINHEIT, dauerSekunden: 0, streckeMeter: 0, zielBelastung: 0 })
    expect('moving_time' in n).toBe(false)
    expect('distance' in n).toBe(false)
    expect('icu_training_load' in n).toBe(false)
  })

  it('laesst eine Beschreibung aus lauter Leerzeichen weg', () => {
    expect('description' in icuNutzlast({ ...EINHEIT, beschreibung: '   \n ' })).toBe(false)
  })

  it('rundet auf ganze Sekunden und Meter', () => {
    const n = icuNutzlast({ ...EINHEIT, dauerSekunden: 3599.6, streckeMeter: 11999.4 })
    expect(n.moving_time).toBe(3600)
    expect(n.distance).toBe(11999)
  })

  it('zeigt in der Vorschau genau das, was uebertragen wird', () => {
    // Der Punkt der ganzen Datei: Vorschau und Übertragung teilen sich die
    // Quelle. Ein zweiter Weg waere eine Vorschau, die etwas anderes zeigt.
    expect(JSON.parse(nutzlastText(EINHEIT))).toEqual(icuNutzlast(EINHEIT))
  })
})
