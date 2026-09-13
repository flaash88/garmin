import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Prüft die Schreibpfade gegen eine echte PostgreSQL-Instanz. Der Teil, der
 * sich nicht durch Typen absichern lässt: greift das Upsert, ist ein zweiter
 * Durchlauf wirklich folgenlos, überlebt der Rohsatz.
 *
 * Ohne TAKT_TEST_DATENBANK_URL wird die Reihe übersprungen statt rot zu sein
 * — ohne laufende Datenbank ist sie nicht aussagekräftig.
 */
const URL_ = process.env['TAKT_TEST_DATENBANK_URL']
const wenn = URL_ ? describe : describe.skip

vi.mock('@/lib/icu/endpunkte', () => ({
  aktivitaetenHolen: vi.fn(),
  wellnessHolen: vi.fn(),
  planHolen: vi.fn(),
  ausruestungHolen: vi.fn(),
  zonenHolen: vi.fn(),
}))

wenn('Abgleich gegen eine echte Datenbank', () => {
  let datenbank: typeof import('@/lib/db').datenbank
  let schema: typeof import('@/lib/db/schema')
  let lauf: typeof import('./lauf')
  let endpunkte: typeof import('@/lib/icu/endpunkte')

  beforeAll(async () => {
    process.env['TAKT_DATENBANK_URL'] = URL_
    process.env['ICU_API_KEY'] = 'probe'
    process.env['ICU_ATHLET_ID'] = 'i1'
    ;({ datenbank } = await import('@/lib/db'))
    schema = await import('@/lib/db/schema')
    lauf = await import('./lauf')
    endpunkte = await import('@/lib/icu/endpunkte')
  })

  beforeEach(async () => {
    vi.mocked(endpunkte.aktivitaetenHolen).mockReset()
    vi.mocked(endpunkte.wellnessHolen).mockReset()
    /*
     * Nur die eigenen Zeilen wegräumen, nicht die Tabellen leeren.
     *
     * Ein `truncate` hier hat die Testdateien der Phase 5 umgeworfen: die
     * legen eigene Probezeilen an, und vitest führt Dateien nebenläufig aus.
     * Unter UTC ging es gut, unter America/New_York verschob sich die
     * Reihenfolge und vier Tests fielen um — ein Fehlschlag, der nichts mit
     * Zeitzonen zu tun hatte, sondern mit geteiltem Zustand. Siehe
     * DECISIONS.md, E5.6.
     */
    await datenbank().execute(
      sql`delete from ${schema.aktivitaeten} where id like 'i%'`,
    )
    await datenbank().execute(
      sql`delete from ${schema.wellness} where tag between '2026-09-01' and '2026-09-30'`,
    )
    vi.mocked(endpunkte.zonenHolen).mockReset()
    vi.mocked(endpunkte.planHolen).mockReset()
    vi.mocked(endpunkte.ausruestungHolen).mockReset()
    await datenbank().execute(sql`delete from ${schema.abgleich}`)
    await datenbank().execute(sql`delete from ${schema.zonen}`)
    await datenbank().execute(
      sql`delete from ${schema.feldbefuellung} where quelle = 'wellness'`,
    )
  })

  /** Nur die Zeilen dieser Datei — erkennbar am Praefix i. */
  async function eigeneAktivitaeten() {
    return datenbank()
      .select()
      .from(schema.aktivitaeten)
      .where(sql`id like 'i%'`)
  }

  const AKTIVITAET = {
    id: 'i4711',
    start_date_local: '2026-09-13T06:45:00',
    name: 'Morgenlauf',
    type: 'Run',
    moving_time: 2531,
    distance: 8420.5,
    icu_training_load: 62,
  }

  it('schreibt eine Aktivitaet und behaelt den Rohsatz', async () => {
    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([AKTIVITAET])
    const e = await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })
    expect(e.geschrieben).toBe(1)

    const zeilen = await eigeneAktivitaeten()
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]?.name).toBe('Morgenlauf')
    expect(zeilen[0]?.belastung).toBe(62)
    expect(zeilen[0]?.rohdaten).toEqual(AKTIVITAET)
  })

  it('legt beim zweiten Durchlauf keine zweite Zeile an', async () => {
    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([AKTIVITAET])
    await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })
    await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })

    const zeilen = await eigeneAktivitaeten()
    expect(zeilen).toHaveLength(1)
  })

  it('uebernimmt eine spaetere Aenderung an derselben Aktivitaet', async () => {
    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([AKTIVITAET])
    await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })

    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([
      { ...AKTIVITAET, name: 'Morgenlauf, umbenannt', icu_training_load: 70 },
    ])
    await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })

    const zeilen = await eigeneAktivitaeten()
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]?.name).toBe('Morgenlauf, umbenannt')
    expect(zeilen[0]?.belastung).toBe(70)
  })

  it('merkt sich den Stand des Abgleichs', async () => {
    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([])
    await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })

    const zeilen = await datenbank().select().from(schema.abgleich)
    expect(zeilen.find((z) => z.quelle === 'aktivitaeten')?.zuletztAm).toBeInstanceOf(Date)
  })

  it('laesst unbrauchbare Saetze aus, ohne den Lauf abzubrechen', async () => {
    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([
      AKTIVITAET,
      { kein: 'gueltiger Satz' },
      { id: 'i2', start_date_local: 'Unfug', type: 'Run' },
    ])
    const e = await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })
    expect(e.geschrieben).toBe(1)
  })

  it('haelt fest, welche Wellness-Felder befuellt waren', async () => {
    // Genau die Frage aus E0.8: Hauttemperatur und Atemfrequenz kommen leer
    // an, Ruhepuls und Beschwerden nicht.
    vi.mocked(endpunkte.wellnessHolen).mockResolvedValue([
      { id: '2026-09-12', restingHR: 44, soreness: 'Wade', skinTemp: null, respiration: null },
      { id: '2026-09-13', restingHR: 43, soreness: null, skinTemp: null, respiration: null },
    ])
    const e = await lauf.wellnessAbgleichen({ schluessel: 'x', athletId: 'i1' })
    await lauf.befuellungFesthalten('wellness', e.saetze)

    const zeilen = await datenbank().select().from(schema.feldbefuellung)
    const nach = new Map(zeilen.map((z) => [z.feld, z]))

    expect(nach.get('restingHR')?.befuellt).toBe(2)
    expect(nach.get('soreness')?.befuellt).toBe(1)
    expect(nach.get('skinTemp')?.befuellt).toBe(0)
    expect(nach.get('respiration')?.befuellt).toBe(0)
    expect(nach.get('skinTemp')?.gesamt).toBe(2)
  })

  it('speichert Zonen je Sportart aus der echten Antwortform', async () => {
    // Die Antwort, wie sie im Betrieb ankommt: ein Satz je Gruppe, die
    // Sportarten als Array unter `types`. Vorher wurde `type` gelesen —
    // jeder Satz fiel durch, und «Zonen 0» sah aus wie ein Erfolg.
    vi.mocked(endpunkte.zonenHolen).mockResolvedValue([
      {
        types: ['Ride', 'VirtualRide'],
        lthr: 200,
        max_hr: 220,
        hr_zones: [161, 179, 187, 199, 205, 211, 220],
      },
      {
        types: ['Run', 'VirtualRun', 'TrailRun'],
        lthr: 165,
        max_hr: 196,
        hr_zones: [130, 148, 162, 177, 184, 192, 196],
        threshold_pace: 3.4,
      },
    ])

    const e = await lauf.zonenAbgleichen({ schluessel: 'x', athletId: 'i1' })
    expect(e.geholt).toBe(2)
    expect(e.geschrieben).toBe(5)

    const zeilen = await datenbank().select().from(schema.zonen)
    const nach = new Map(zeilen.map((z) => [z.sportart, z]))
    expect([...nach.keys()].sort()).toEqual(
      ['Ride', 'Run', 'TrailRun', 'VirtualRide', 'VirtualRun'].sort(),
    )
    // Der Punkt: Lauf bekommt die Laufwerte, nicht die Radwerte.
    expect(nach.get('Run')?.schwellenPuls).toBe(165)
    expect(nach.get('TrailRun')?.schwellenPuls).toBe(165)
    expect(nach.get('Ride')?.schwellenPuls).toBe(200)
    expect(nach.get('Run')?.schwellenPaceSekundenJeKm).toBeCloseTo(294.1, 1)
  })

  it('schreibt die echte Antwort des Athleten vollstaendig weg', async () => {
    // Dieselbe Antwort wie in sport-settings-echt.test.ts, hier aber ueber
    // den ganzen Weg bis in die Tabelle.
    const { readFileSync } = await import('node:fs')
    const antwort = JSON.parse(
      readFileSync(new URL('../icu/proben/sport-settings.json', import.meta.url), 'utf8'),
    ) as Array<Record<string, unknown>>
    vi.mocked(endpunkte.zonenHolen).mockResolvedValue(antwort)

    const e = await lauf.zonenAbgleichen({ schluessel: 'x', athletId: 'i706078' })
    expect(e.geholt).toBe(4)
    expect(e.geschrieben).toBe(12)

    const zeilen = await datenbank().select().from(schema.zonen)
    const nach = new Map(zeilen.map((z) => [z.sportart, z]))
    expect(zeilen).toHaveLength(12)
    expect(nach.get('Run')?.schwellenPuls).toBe(165)
    expect(nach.get('TrailRun')?.maxPuls).toBe(196)
    expect(nach.get('Ride')?.schwellenPuls).toBe(200)
    // Kein Schwellentempo hinterlegt — das kostet den Satz nicht.
    expect(nach.get('Run')?.schwellenPaceSekundenJeKm).toBeNull()
    expect(nach.get('Run')?.pulsGrenzen).toEqual([130, 148, 162, 177, 184, 192, 196])

    // Ein zweiter Lauf ändert nichts und legt nichts doppelt an.
    const zweiter = await lauf.zonenAbgleichen({ schluessel: 'x', athletId: 'i706078' })
    expect(zweiter.geschrieben).toBe(12)
    expect(await datenbank().select().from(schema.zonen)).toHaveLength(12)
  })

  it('meldet einen Schritt ohne Ergebnis als Warnung, nicht als Erfolg', async () => {
    // Der eigentliche Befund: nicht der Fehler, sondern dass er sich als
    // Erfolg meldete. Antwort nicht leer, Ergebnis leer — das ist eine
    // Warnung mit Grund.
    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([])
    vi.mocked(endpunkte.wellnessHolen).mockResolvedValue([])
    vi.mocked(endpunkte.planHolen).mockResolvedValue([])
    vi.mocked(endpunkte.ausruestungHolen).mockResolvedValue([])
    vi.mocked(endpunkte.zonenHolen).mockResolvedValue([
      { lthr: 165, max_hr: 196, hr_zones: [130, 148, 162, 177, 184, 192, 196] },
    ])

    const f = await lauf.abgleichLaufen('2026-09-01')

    expect(f.fehler).toHaveLength(0)
    expect(f.warnungen).toHaveLength(1)
    expect(f.warnungen[0]).toContain('Zonen')
    expect(f.warnungen[0]).toContain('1 Satz geholt')
    // Der Grund nennt, was fehlt — sonst hilft die Warnung nicht weiter.
    expect(f.warnungen[0]).toContain('types')

    const zeilen = lauf.fortschrittZeilen(f)
    expect(zeilen[0]).toMatch(/^ABGLEICH OHNE ERGEBNIS/)
    expect(zeilen[0]).not.toContain('alle Schritte durchgelaufen')

    // Und der Grund steht auch in der Tabelle, nicht nur im Bericht.
    const stand = await datenbank()
      .select()
      .from(schema.abgleich)
      .where(sql`quelle = 'zonen'`)
    expect(stand[0]?.zuletztFehler).toContain('types')
  })

  it('schweigt, wenn die Antwort selbst leer war', async () => {
    // Nichts geholt, nichts geschrieben ist kein Befund, sondern Ruhe.
    vi.mocked(endpunkte.aktivitaetenHolen).mockResolvedValue([])
    vi.mocked(endpunkte.wellnessHolen).mockResolvedValue([])
    vi.mocked(endpunkte.planHolen).mockResolvedValue([])
    vi.mocked(endpunkte.ausruestungHolen).mockResolvedValue([])
    vi.mocked(endpunkte.zonenHolen).mockResolvedValue([])

    const f = await lauf.abgleichLaufen('2026-09-01')
    expect(f.warnungen).toHaveLength(0)
    expect(lauf.fortschrittZeilen(f)[0]).toContain('alle Schritte durchgelaufen')
  })

  it('uebernimmt Wellness samt CTL, ATL und Form', async () => {
    vi.mocked(endpunkte.wellnessHolen).mockResolvedValue([
      { id: '2026-09-13', ctl: 52.4, atl: 61.8, form: -9.4, comments: 'Mued.' },
    ])
    await lauf.wellnessAbgleichen({ schluessel: 'x', athletId: 'i1' })

    const zeilen = await datenbank()
      .select()
      .from(schema.wellness)
      .where(sql`tag = '2026-09-13'`)
    expect(zeilen[0]?.tag).toBe('2026-09-13')
    expect(zeilen[0]?.ctl).toBeCloseTo(52.4, 6)
    expect(zeilen[0]?.notizen).toBe('Mued.')
  })
})
