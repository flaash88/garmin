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
    await datenbank().execute(sql`delete from ${schema.abgleich}`)
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
    const anzahl = await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })
    expect(anzahl).toBe(1)

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
    const anzahl = await lauf.aktivitaetenAbgleichen({ schluessel: 'x', athletId: 'i1' })
    expect(anzahl).toBe(1)
  })

  it('haelt fest, welche Wellness-Felder befuellt waren', async () => {
    // Genau die Frage aus E0.8: Hauttemperatur und Atemfrequenz kommen leer
    // an, Ruhepuls und Beschwerden nicht.
    vi.mocked(endpunkte.wellnessHolen).mockResolvedValue([
      { id: '2026-09-12', restingHR: 44, soreness: 'Wade', skinTemp: null, respiration: null },
      { id: '2026-09-13', restingHR: 43, soreness: null, skinTemp: null, respiration: null },
    ])
    const e = await lauf.wellnessAbgleichen({ schluessel: 'x', athletId: 'i1' })
    await lauf.befuellungFesthalten('wellness', e.roh)

    const zeilen = await datenbank().select().from(schema.feldbefuellung)
    const nach = new Map(zeilen.map((z) => [z.feld, z]))

    expect(nach.get('restingHR')?.befuellt).toBe(2)
    expect(nach.get('soreness')?.befuellt).toBe(1)
    expect(nach.get('skinTemp')?.befuellt).toBe(0)
    expect(nach.get('respiration')?.befuellt).toBe(0)
    expect(nach.get('skinTemp')?.gesamt).toBe(2)
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
