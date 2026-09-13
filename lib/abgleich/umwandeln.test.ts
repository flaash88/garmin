import { describe, expect, it } from 'vitest'
import {
  aktivitaetUmwandeln,
  ausruestungUmwandeln,
  planUmwandeln,
  wellnessUmwandeln,
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
