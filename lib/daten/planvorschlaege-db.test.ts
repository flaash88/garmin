import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * Zustände und Aufräumen gegen eine echte Datenbank.
 *
 * Ohne TAKT_TEST_DATENBANK_URL wird die Reihe übersprungen statt rot zu sein.
 */
const URL_ = process.env['TAKT_TEST_DATENBANK_URL']
const wenn = URL_ ? describe : describe.skip

wenn('Plansätze in der Datenbank', () => {
  let datenbank: typeof import('@/lib/db').datenbank
  let p: typeof import('./planvorschlaege')

  beforeAll(async () => {
    process.env['TAKT_DATENBANK_URL'] = URL_
    ;({ datenbank } = await import('@/lib/db'))
    p = await import('./planvorschlaege')
  })

  beforeEach(async () => {
    await datenbank().execute(sql`delete from planvorschlaege where ziel like 'PROBE-%'`)
  })

  async function satz(einheiten: Parameters<typeof p.einheitenAnhaengen>[1]) {
    const id = await p.vorschlagAnlegen({
      ziel: 'PROBE-Zustaende',
      vonTag: '2026-09-14',
      bisTag: '2026-11-08',
      wochen: 8,
    })
    await p.einheitenAnhaengen(id, einheiten)
    return id
  }

  it('haengt Einheiten in Reihenfolge an, auch ueber mehrere Aufrufe', async () => {
    const id = await satz([{ tag: '2026-09-14', name: 'A' }])
    await p.einheitenAnhaengen(id, [
      { tag: '2026-09-15', name: 'B' },
      { tag: '2026-09-16', name: 'C' },
    ])
    const gelesen = await p.vorschlagLesen(id)
    expect(gelesen?.einheiten.map((e) => e.name)).toEqual(['A', 'B', 'C'])
    expect(await p.einheitenZaehlen(id)).toBe(3)
  })

  it('haelt verworfene Einheiten aus dem Wochenraster heraus', async () => {
    const id = await satz([
      { tag: '2026-09-14', name: 'Bleibt' },
      { tag: '2026-09-15', name: 'Weg' },
    ])
    const gelesen = await p.vorschlagLesen(id)
    const weg = gelesen?.einheiten.find((e) => e.name === 'Weg')
    await p.einheitVerwerfen(weg?.id ?? '')

    const imRaster = await p.einheitenImZeitraum('2026-09-14', '2026-09-20')
    expect(imRaster.map((e) => e.name)).toContain('Bleibt')
    expect(imRaster.map((e) => e.name)).not.toContain('Weg')
  })

  it('laesst beim Verwerfen des Satzes uebertragene Einheiten unberuehrt', async () => {
    const id = await satz([
      { tag: '2026-09-14', name: 'Schon drin' },
      { tag: '2026-09-15', name: 'Noch offen' },
    ])
    const vorher = await p.vorschlagLesen(id)
    const drin = vorher?.einheiten.find((e) => e.name === 'Schon drin')
    await p.zustandSetzen(drin?.id ?? '', 'uebertragen', { icuEventId: 'e1' })

    await p.vorschlagVerwerfen(id)

    const nachher = await p.vorschlagLesen(id)
    expect(nachher?.vorschlag.verworfenAm).not.toBeNull()
    expect(nachher?.einheiten.find((e) => e.name === 'Schon drin')?.zustand).toBe(
      'uebertragen',
    )
    expect(nachher?.einheiten.find((e) => e.name === 'Noch offen')?.zustand).toBe('verworfen')
  })

  it('raeumt verworfene Saetze erst nach sieben Tagen weg', async () => {
    const id = await satz([{ tag: '2026-09-14', name: 'A' }])
    await p.vorschlagVerwerfen(id)

    // Sechs Tage später: steht noch da.
    const sechs = new Date(Date.now() + 6 * 86_400_000)
    expect(await p.verworfeneAufraeumen(sechs)).toBe(0)
    expect(await p.vorschlagLesen(id)).not.toBeNull()

    // Acht Tage später: weg, samt Einheiten.
    const acht = new Date(Date.now() + 8 * 86_400_000)
    expect(await p.verworfeneAufraeumen(acht)).toBeGreaterThanOrEqual(1)
    expect(await p.vorschlagLesen(id)).toBeNull()

    const rest = await datenbank().execute(
      sql`select count(*)::int as anzahl from planeinheiten where vorschlag_id = ${id}`,
    )
    expect((rest.rows[0] as { anzahl: number }).anzahl).toBe(0)
  })

  it('laesst einen verworfenen Satz mit uebertragener Einheit stehen', async () => {
    // Er ist der einzige Beleg dafuer, wie die Einheit in den Kalender kam.
    const id = await satz([
      { tag: '2026-09-14', name: 'Steht in intervals.icu' },
      { tag: '2026-09-15', name: 'Nur Vorschlag' },
    ])
    const gelesen = await p.vorschlagLesen(id)
    const drin = gelesen?.einheiten.find((e) => e.name === 'Steht in intervals.icu')
    await p.zustandSetzen(drin?.id ?? '', 'uebertragen', { icuEventId: 'e1' })
    await p.vorschlagVerwerfen(id)

    await p.verworfeneAufraeumen(new Date(Date.now() + 30 * 86_400_000))
    expect(await p.vorschlagLesen(id)).not.toBeNull()
  })

  it('raeumt Saetze, die niemand verworfen hat, nie weg', async () => {
    const id = await satz([{ tag: '2026-09-14', name: 'A' }])
    await p.verworfeneAufraeumen(new Date(Date.now() + 365 * 86_400_000))
    expect(await p.vorschlagLesen(id)).not.toBeNull()
  })

  it('laesst neben uebertragenen und verworfenen die offene Einheit stehen', async () => {
    const id = await satz([
      { tag: '2026-09-14', name: 'A' },
      { tag: '2026-09-15', name: 'B' },
      { tag: '2026-09-16', name: 'C' },
    ])
    const gelesen = await p.vorschlagLesen(id)
    const nach = (name: string) => gelesen?.einheiten.find((e) => e.name === name)?.id ?? ''
    await p.zustandSetzen(nach('A'), 'uebertragen')
    await p.einheitVerwerfen(nach('B'))

    const nachher = await p.vorschlagLesen(id)
    expect(nachher?.einheiten.filter((e) => e.zustand === 'vorschlag')).toHaveLength(1)
  })
})
