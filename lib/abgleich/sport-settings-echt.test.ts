import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { zonenUmwandeln } from './umwandeln'
import { istLeerbefund, leerbefund } from './leerbefund'
import { PFLICHTFELDER } from './lauf'
import { pulsgrenzen, zuGruppen, type Zonensatz } from '@/lib/daten/zonen'
import { zoneFuerPuls } from '@/lib/analyse/zonen'

/**
 * Die **echte** Antwort von `GET /athlete/{id}/sport-settings`, wie sie der
 * Athlet aus seinem Konto geliefert hat. Liegt als
 * `lib/icu/proben/sport-settings.json` im Repo.
 *
 * Bisher war die Antwortform beschrieben und nachgebaut. Hier ist sie
 * abgelegt: vier Sätze, zwölf Sportarten, `threshold_pace` und `pace_zones`
 * durchweg `null`, weil kein Schwellentempo hinterlegt ist. Genau das Feld,
 * dessen Fehlen den Satz nicht kosten darf.
 */
const ANTWORT = JSON.parse(
  readFileSync(new URL('../icu/proben/sport-settings.json', import.meta.url), 'utf8'),
) as unknown[]

describe('sport-settings, echte Antwort des Athleten', () => {
  const zeilen = ANTWORT.flatMap(zonenUmwandeln)

  it('verwirft keinen Satz — die Antwort hat vier, alle tragen', () => {
    expect(ANTWORT).toHaveLength(4)
    const gruppen = new Set(zeilen.map((z) => z.gruppe.join(',')))
    expect(gruppen.size).toBe(4)
  })

  it('loest die vier Gruppen in zwoelf Sportarten auf', () => {
    expect(zeilen).toHaveLength(12)
    expect(zeilen.map((z) => z.sportart).sort()).toEqual(
      [
        'Cyclocross', 'GravelRide', 'MountainBikeRide', 'OpenWaterSwim', 'Other',
        'Ride', 'Run', 'Swim', 'TrackRide', 'TrailRun', 'VirtualRide', 'VirtualRun',
      ].sort(),
    )
  })

  it('behaelt den Satz, obwohl threshold_pace und pace_zones null sind', () => {
    // Kein Schwellentempo hinterlegt. Das darf den Eintrag nicht kosten —
    // und es darf auch keine erfundene Pace erzeugen.
    for (const z of zeilen) {
      expect(z.schwellenPaceMeterJeSekunde).toBeNull()
      expect(z.schwellenPaceSekundenJeKm).toBeNull()
      expect(z.paceGrenzen).toBeNull()
      expect(z.schwellenPuls).not.toBeNull()
      expect(z.pulsGrenzen).not.toBeNull()
    }
  })

  it('zieht fuer Laeufe den Run-Eintrag, nicht den Rad-Eintrag', () => {
    const nach = new Map(zeilen.map((z) => [z.sportart, z]))
    for (const sportart of ['Run', 'VirtualRun', 'TrailRun']) {
      expect(nach.get(sportart)?.schwellenPuls).toBe(165)
      expect(nach.get(sportart)?.maxPuls).toBe(196)
      expect(nach.get(sportart)?.pulsGrenzen).toEqual([130, 148, 162, 177, 184, 192, 196])
    }
    for (const sportart of ['Ride', 'GravelRide', 'Cyclocross']) {
      expect(nach.get(sportart)?.schwellenPuls).toBe(200)
      expect(nach.get(sportart)?.maxPuls).toBe(220)
    }
  })

  it('haelt Schwimmen und Sonstiges getrennt, obwohl die Werte gleich sind', () => {
    const nach = new Map(zeilen.map((z) => [z.sportart, z]))
    expect(nach.get('Swim')?.pulsGrenzen).toEqual(nach.get('Other')?.pulsGrenzen)
    expect(nach.get('Swim')?.gruppe).toEqual(['Swim', 'OpenWaterSwim'])
    expect(nach.get('Other')?.gruppe).toEqual(['Other'])
  })

  it('uebernimmt die Zonennamen, wie sie geliefert werden', () => {
    const lauf = zeilen.find((z) => z.sportart === 'Run')
    expect(lauf?.pulsZonenNamen).toEqual([
      'Recovery', 'Aerobic', 'Tempo', 'SubThreshold', 'SuperThreshold',
      'Aerobic Capacity', 'Anaerobic',
    ])
  })

  it('behaelt Leistungszonen und FTP im Rohsatz, auch ohne eigene Spalte', () => {
    // Takt wertet Laufen aus und führt keine Leistungszonen. Wegwerfen wäre
    // trotzdem falsch: der Rohsatz ist die Rückfallebene.
    const rad = zeilen.find((z) => z.sportart === 'Ride')
    expect(rad?.rohdaten['ftp']).toBe(250)
    expect(rad?.rohdaten['power_zones']).toEqual([55, 75, 90, 105, 120, 150, 999])
  })

  it('loest keinen Leerbefund aus', () => {
    expect(istLeerbefund(ANTWORT.length, zeilen.length)).toBe(false)
  })

  it('haette den alten Fehler benannt, waere er noch da', () => {
    // Gegenprobe zur Warnung: die alte Auswertung suchte `type`. Mit dieser
    // Erwartung findet der Befund kein einziges Feld und sagt genau das.
    const text = leerbefund('Zonen', ANTWORT, ['type'])
    expect(text).toContain('4 Sätze geholt')
    expect(text).toContain('keines davon ist da')
    expect(text).toContain('types')
    // Und mit der heutigen Erwartung greift er gar nicht erst.
    expect(PFLICHTFELDER['zonen']).toContain('types')
  })

  it('zeigt im Profil vier Gruppen, Laufen zuerst', () => {
    const saetze = zeilen.map((z) => ({ ...z, geholtAm: new Date() }) as unknown as Zonensatz)
    const gruppen = zuGruppen(saetze)
    expect(gruppen).toHaveLength(4)
    expect(gruppen[0]?.sportarten).toEqual(['Run', 'TrailRun', 'VirtualRun'])
    expect(pulsgrenzen(gruppen[0]?.satz ?? null)).toEqual([130, 148, 162, 177, 184, 192, 196])
  })

  it('ordnet denselben Puls je nach Sportart verschieden ein', () => {
    const nach = new Map(zeilen.map((z) => [z.sportart, z]))
    const lauf = nach.get('Run')?.pulsGrenzen ?? []
    const rad = nach.get('Ride')?.pulsGrenzen ?? []
    // Der Grund für die ganze Zuordnung.
    expect(zoneFuerPuls(170, lauf)).toBe(4)
    expect(zoneFuerPuls(170, rad)).toBe(2)
  })

  it('rechnet die letzte Grenze als Maximalpuls und laesst nichts darueber fallen', () => {
    const lauf = zeilen.find((z) => z.sportart === 'Run')
    const grenzen = lauf?.pulsGrenzen ?? []
    expect(grenzen.at(-1)).toBe(lauf?.maxPuls)
    // Ein Ausreisser über den Maximalpuls zaehlt in die hoechste Zone.
    expect(zoneFuerPuls(201, grenzen)).toBe(7)
  })
})
