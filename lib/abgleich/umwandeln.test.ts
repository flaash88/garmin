import { describe, expect, it } from 'vitest'
import {
  aktivitaetUmwandeln,
  ausruestungUmwandeln,
  paceAusGeschwindigkeit,
  planUmwandeln,
  wellnessUmwandeln,
  zonenUmwandeln,
} from './umwandeln'

describe('aktivitaetUmwandeln', () => {
  it('liest einen vollstaendigen Satz', () => {
    const z = aktivitaetUmwandeln({
      id: 'i123',
      start_date_local: '2026-09-13T06:45:00',
      name: 'Morgenlauf',
      type: 'Run',
      moving_time: 2531,
      distance: 8420.5,
      average_heartrate: 148,
      icu_training_load: 62,
    })
    expect(z?.id).toBe('i123')
    expect(z?.typ).toBe('Run')
    expect(z?.dauerSekunden).toBe(2531)
    expect(z?.streckeMeter).toBeCloseTo(8420.5, 6)
    expect(z?.belastung).toBe(62)
  })

  it('weicht auf elapsed_time aus, wenn moving_time fehlt', () => {
    const z = aktivitaetUmwandeln({
      id: 'i1', start_date_local: '2026-09-13T06:45:00', type: 'Run', elapsed_time: 3000,
    })
    expect(z?.dauerSekunden).toBe(3000)
  })

  it('unterscheidet fehlend von null', () => {
    const z = aktivitaetUmwandeln({
      id: 'i1', start_date_local: '2026-09-13T06:45:00', type: 'Run',
    })
    // Kein Puls geliefert. Nicht 0 — sonst stuende in der Oberflaeche
    // spaeter '0 Schlaege'.
    expect(z?.pulsSchnitt).toBeNull()
    expect(z?.belastung).toBeNull()
  })

  it('behaelt den Rohsatz vollstaendig', () => {
    const roh = {
      id: 'i1', start_date_local: '2026-09-13T06:45:00', type: 'Run',
      ein_feld_das_wir_heute_nicht_kennen: 42,
    }
    expect(aktivitaetUmwandeln(roh)?.rohdaten).toEqual(roh)
  })

  it('weist Saetze ohne Kennung oder Beginn ab', () => {
    expect(aktivitaetUmwandeln({ start_date_local: '2026-09-13T06:45:00' })).toBeNull()
    expect(aktivitaetUmwandeln({ id: 'i1' })).toBeNull()
    expect(aktivitaetUmwandeln({ id: 'i1', start_date_local: 'Unfug' })).toBeNull()
    expect(aktivitaetUmwandeln(null)).toBeNull()
    expect(aktivitaetUmwandeln([])).toBeNull()
  })
})

describe('wellnessUmwandeln', () => {
  it('uebernimmt CTL, ATL und Form, ohne sie zu rechnen', () => {
    const z = wellnessUmwandeln({ id: '2026-09-13', ctl: 52.4, atl: 61.8, form: -9.4 })
    expect(z?.ctl).toBeCloseTo(52.4, 6)
    expect(z?.atl).toBeCloseTo(61.8, 6)
    expect(z?.form).toBeCloseTo(-9.4, 6)
  })

  it('laesst Form null, statt sie aus CTL und ATL zu rechnen', () => {
    const z = wellnessUmwandeln({ id: '2026-09-13', ctl: 52.4, atl: 61.8 })
    expect(z?.form).toBeNull()
  })

  it('uebernimmt Beschwerden, Verletzung, Befinden und Notizen', () => {
    const z = wellnessUmwandeln({
      id: '2026-09-13',
      soreness: 'Achillessehne links',
      injury: 'keine',
      mood: 3,
      comments: 'Schlecht geschlafen.',
    })
    expect(z?.beschwerden).toBe('Achillessehne links')
    expect(z?.verletzung).toBe('keine')
    expect(z?.befinden).toBe(3)
    expect(z?.notizen).toBe('Schlecht geschlafen.')
  })

  it('nimmt Schlaf in Sekunden oder in Stunden', () => {
    expect(wellnessUmwandeln({ id: '2026-09-13', sleepSecs: 27000 })?.schlafSekunden)
      .toBe(27000)
    expect(wellnessUmwandeln({ id: '2026-09-13', sleepHours: 7.5 })?.schlafSekunden)
      .toBe(27000)
  })

  it('haelt null Sekunden Schlaf von fehlendem Schlaf auseinander', () => {
    expect(wellnessUmwandeln({ id: '2026-09-13', sleepSecs: 0 })?.schlafSekunden).toBe(0)
    expect(wellnessUmwandeln({ id: '2026-09-13' })?.schlafSekunden).toBeNull()
  })

  it('schneidet einen vollen Zeitstempel auf den Tag zurueck', () => {
    expect(wellnessUmwandeln({ id: '2026-09-13T00:00:00Z' })?.tag).toBe('2026-09-13')
  })

  it('weist Saetze ohne Tag ab', () => {
    expect(wellnessUmwandeln({ ctl: 50 })).toBeNull()
  })
})

describe('planUmwandeln', () => {
  it('liest einen geplanten Eintrag', () => {
    const z = planUmwandeln({
      id: 'e9', start_date_local: '2026-09-16T00:00:00', name: '5 × 1000 m',
      type: 'Run', description: 'Zielpace 3:45', icu_training_load: 78,
    })
    expect(z?.tag).toBe('2026-09-16')
    expect(z?.name).toBe('5 × 1000 m')
    expect(z?.zielBelastung).toBe(78)
  })
})

describe('ausruestungUmwandeln', () => {
  it('liest Schuh und Laufleistung', () => {
    const z = ausruestungUmwandeln({
      id: 'g1', name: 'Nimbus 26', type: 'Shoes', distance: 412_000,
    })
    expect(z?.name).toBe('Nimbus 26')
    expect(z?.laufleistungMeter).toBe(412_000)
    expect(z?.inBenutzung).toBe(1)
  })

  it('merkt sich stillgelegte Schuhe', () => {
    expect(ausruestungUmwandeln({ id: 'g1', name: 'Alt', retired: true })?.inBenutzung)
      .toBe(0)
  })
})

/**
 * Die Antwort von GET /athlete/{id}/sport-settings, wie sie im Betrieb
 * ankommt. Vier Sätze, einer je Sportartgruppe; die Sportarten stehen als
 * Array unter `types`, die Zonen sind sieben Obergrenzen.
 */
const SPORT_SETTINGS = [
  {
    id: 11,
    types: ['Ride', 'VirtualRide', 'EBikeRide', 'Handcycle', 'Velomobile'],
    lthr: 200,
    max_hr: 220,
    hr_zones: [161, 179, 187, 199, 205, 211, 220],
    hr_zone_names: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'],
    threshold_pace: 11.1,
    pace_zones: [55, 75, 90, 105, 120, 150],
  },
  {
    id: 12,
    types: ['Run', 'VirtualRun', 'TrailRun'],
    lthr: 165,
    max_hr: 196,
    hr_zones: [130, 148, 162, 177, 184, 192, 196],
    hr_zone_names: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'],
    threshold_pace: 3.4,
    pace_zones: [78, 88, 95, 105, 115, 130],
  },
  {
    id: 13,
    types: ['Swim', 'OpenWaterSwim'],
    lthr: 200,
    max_hr: 220,
    hr_zones: [161, 179, 187, 199, 205, 211, 220],
    threshold_pace: 1.2,
  },
  { id: 14, types: ['Other'], lthr: 200, max_hr: 220, hr_zones: [161, 179, 187, 199, 205, 211, 220] },
]

describe('zonenUmwandeln', () => {
  it('liest die Sportarten aus types, nicht aus type', () => {
    // Der Befund: gelesen wurde `type` als Zeichenkette. Das Feld gibt es
    // nicht — also fiel jeder Satz durch und der Schritt meldete «Zonen 0».
    const zeilen = SPORT_SETTINGS.flatMap(zonenUmwandeln)
    expect(zeilen.length).toBeGreaterThan(0)
  })

  it('macht aus einer Gruppe eine Zeile je Sportart', () => {
    const zeilen = zonenUmwandeln(SPORT_SETTINGS[1])
    expect(zeilen.map((z) => z.sportart)).toEqual(['Run', 'VirtualRun', 'TrailRun'])
    // Die Gruppe bleibt an jeder Zeile sichtbar.
    expect(zeilen[0]?.gruppe).toEqual(['Run', 'VirtualRun', 'TrailRun'])
  })

  it('haelt Rad- und Laufwerte auseinander', () => {
    // Der eigentliche Zweck: wer Laeufe auswertet, muss 165 bekommen, nicht 200.
    const alle = SPORT_SETTINGS.flatMap(zonenUmwandeln)
    const lauf = alle.find((z) => z.sportart === 'Run')
    const rad = alle.find((z) => z.sportart === 'Ride')
    expect(lauf?.schwellenPuls).toBe(165)
    expect(lauf?.maxPuls).toBe(196)
    expect(rad?.schwellenPuls).toBe(200)
    expect(rad?.maxPuls).toBe(220)
    expect(lauf?.pulsGrenzen).toEqual([130, 148, 162, 177, 184, 192, 196])
  })

  it('uebernimmt Zonennamen und Pace-Zonen', () => {
    const lauf = zonenUmwandeln(SPORT_SETTINGS[1])[0]
    expect(lauf?.pulsZonenNamen).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'])
    expect(lauf?.paceGrenzen).toEqual([78, 88, 95, 105, 115, 130])
  })

  it('kommt ohne Zonennamen und Pace-Zonen aus', () => {
    const anderes = zonenUmwandeln(SPORT_SETTINGS[3])[0]
    expect(anderes?.pulsZonenNamen).toBeNull()
    expect(anderes?.paceGrenzen).toBeNull()
    expect(anderes?.schwellenPaceMeterJeSekunde).toBeNull()
  })

  it('rechnet die Schwellenpace aus der Geschwindigkeit um', () => {
    const lauf = zonenUmwandeln(SPORT_SETTINGS[1])[0]
    // 3,4 m/s sind 294 s/km — also 4:54/km. Unveraendert uebernommen waere
    // es «0:03/km» gewesen.
    expect(lauf?.schwellenPaceMeterJeSekunde).toBe(3.4)
    expect(lauf?.schwellenPaceSekundenJeKm).toBeCloseTo(294.1, 1)
  })

  it('nimmt auch eine einzelne Sportart unter type', () => {
    const zeilen = zonenUmwandeln({ type: 'Run', lthr: 165 })
    expect(zeilen.map((z) => z.sportart)).toEqual(['Run'])
  })

  it('laesst einen Satz ohne Sportart weg', () => {
    expect(zonenUmwandeln({ lthr: 165, max_hr: 196 })).toEqual([])
    expect(zonenUmwandeln({ types: [] })).toEqual([])
    expect(zonenUmwandeln({ types: 'Run' })).toEqual([])
    expect(zonenUmwandeln('Unfug')).toEqual([])
  })

  it('behaelt den Rohsatz an jeder Zeile', () => {
    const zeilen = zonenUmwandeln(SPORT_SETTINGS[1])
    for (const z of zeilen) expect(z.rohdaten).toEqual(SPORT_SETTINGS[1])
  })
})

describe('paceAusGeschwindigkeit', () => {
  it('rechnet Meter je Sekunde in Sekunden je Kilometer', () => {
    expect(paceAusGeschwindigkeit(4)).toBe(250)
    expect(paceAusGeschwindigkeit(3.4)).toBeCloseTo(294.1, 1)
  })

  it('laesst eine Zahl, die keine Geschwindigkeit sein kann, unveraendert', () => {
    // 300 waere 3,3 mm/km — das ist offensichtlich schon eine Zeitangabe.
    expect(paceAusGeschwindigkeit(300)).toBe(300)
  })

  it('faellt bei Unsinn auf null zurueck', () => {
    expect(paceAusGeschwindigkeit(null)).toBeNull()
    expect(paceAusGeschwindigkeit(0)).toBeNull()
    expect(paceAusGeschwindigkeit(-3)).toBeNull()
    expect(paceAusGeschwindigkeit(Number.NaN)).toBeNull()
  })
})

describe('Listen in den Zonen werden ganz oder gar nicht uebernommen', () => {
  it('laesst eine Liste mit Luecke weg, statt sie zu verschieben', () => {
    // Ein Filter haette [130, 162] ergeben — die dritte Grenze staende dann
    // an zweiter Stelle und die Kachel beschriftete den falschen Balken.
    const z = zonenUmwandeln({ types: ['Run'], hr_zones: [130, null, 162] })[0]
    expect(z?.pulsGrenzen).toBeNull()
  })

  it('laesst Zonennamen mit Luecke weg', () => {
    const z = zonenUmwandeln({ types: ['Run'], hr_zone_names: ['Z1', '', 'Z3'] })[0]
    expect(z?.pulsZonenNamen).toBeNull()
  })

  it('nimmt vollstaendige Listen unveraendert', () => {
    const z = zonenUmwandeln({ types: ['Run'], hr_zones: [130, 148, 162] })[0]
    expect(z?.pulsGrenzen).toEqual([130, 148, 162])
  })
})
