import { describe, expect, it } from 'vitest'
import { spurAusVerlauf, verlaufsdiagnose } from './verlauf'

describe('spurAusVerlauf', () => {
  it('liest latlng als Paare', () => {
    const s = spurAusVerlauf([
      { type: 'latlng', data: [[47.07, 15.44], [47.08, 15.45]] },
    ])
    expect(s).toEqual([
      { breite: 47.07, laenge: 15.44 },
      { breite: 47.08, laenge: 15.45 },
    ])
  })

  it('liest latlng auch als Objekte', () => {
    const s = spurAusVerlauf([
      { type: 'latlng', data: [{ lat: 47.07, lng: 15.44 }] },
    ])
    expect(s).toEqual([{ breite: 47.07, laenge: 15.44 }])
  })

  it('liest die Reihe auch unter name statt type', () => {
    // Der Befund aus dem Betrieb: 16 Reihen kamen an, keine wurde erkannt.
    expect(spurAusVerlauf([{ name: 'latlng', data: [[47.07, 15.44]] }]))
      .toHaveLength(1)
  })

  it('liest die Werte auch unter values statt data', () => {
    expect(spurAusVerlauf([{ type: 'latlng', values: [[47.07, 15.44]] }]))
      .toHaveLength(1)
  })

  it('setzt getrennte lat- und lng-Reihen zusammen', () => {
    const s = spurAusVerlauf([
      { type: 'lat', data: [47.07, 47.08] },
      { type: 'lng', data: [15.44, 15.45] },
    ])
    expect(s).toHaveLength(2)
    expect(s[1]).toEqual({ breite: 47.08, laenge: 15.45 })
  })

  it('kennt auch position_lat und position_long', () => {
    const s = spurAusVerlauf([
      { name: 'position_lat', values: [47.07] },
      { name: 'position_long', values: [15.44] },
    ])
    expect(s).toEqual([{ breite: 47.07, laenge: 15.44 }])
  })

  it('faellt auf getrennte Reihen zurueck, wenn latlng leer ankam', () => {
    // Sonst haette ein leeres latlng die brauchbaren Reihen verdeckt.
    const s = spurAusVerlauf([
      { type: 'latlng', data: [] },
      { type: 'lat', data: [47.07] },
      { type: 'lng', data: [15.44] },
    ])
    expect(s).toEqual([{ breite: 47.07, laenge: 15.44 }])
  })

  it('laesst unbrauchbare Punkte aus', () => {
    const s = spurAusVerlauf([
      { type: 'latlng', data: [[47.07, 15.44], null, [NaN, 1], ['a', 'b'], [47.08, 15.45]] },
    ])
    expect(s).toHaveLength(2)
  })

  it('gibt eine leere Spur, wenn nichts passt', () => {
    expect(spurAusVerlauf([{ type: 'heartrate', data: [140, 142] }])).toEqual([])
    expect(spurAusVerlauf([])).toEqual([])
  })
})

describe('verlaufsdiagnose', () => {
  it('nennt die angekommenen Reihen', () => {
    const d = verlaufsdiagnose([
      { type: 'heartrate', data: [1] },
      { name: 'cadence', values: [2] },
    ])
    expect(d.reihen).toEqual(['heartrate', 'cadence'])
  })

  it('zaehlt Reihen ohne lesbaren Namen', () => {
    const d = verlaufsdiagnose([{ irgendwas: 1 }, { type: 'time', data: [] }])
    expect(d.ohneNamen).toBe(1)
    expect(d.reihen).toEqual(['time'])
  })

  it('nennt die Felder des ersten Satzes, damit sich die Form ablesen laesst', () => {
    const d = verlaufsdiagnose([{ fremd: 'x', werte: [1] }])
    expect(d.schluesselDesErsten).toEqual(['fremd', 'werte'])
  })

  it('haelt eine leere Liste aus', () => {
    expect(verlaufsdiagnose([])).toEqual({
      reihen: [], ohneNamen: 0, schluesselDesErsten: [],
    })
  })
})
