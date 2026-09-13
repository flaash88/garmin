import { sql } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Der Freigabeweg gegen eine echte Datenbank, mit intervals.icu als Attrappe.
 *
 * Geprüft wird der Fall, der schwierig ist: was passiert, wenn die
 * Übertragung scheitert. Dass sie bei gutem Wetter klappt, sagt über den
 * Zustandswechsel nichts aus.
 *
 * Ohne TAKT_TEST_DATENBANK_URL wird die Reihe übersprungen statt rot zu sein.
 */
const URL_ = process.env['TAKT_TEST_DATENBANK_URL']
const wenn = URL_ ? describe : describe.skip

vi.mock('@/lib/icu/endpunkte', () => ({
  planEintragen: vi.fn(),
  planLoeschen: vi.fn(),
}))

wenn('Freigabe und Übertragung', () => {
  let datenbank: typeof import('@/lib/db').datenbank
  let p: typeof import('@/lib/daten/planvorschlaege')
  let u: typeof import('./uebertragen')
  let endpunkte: typeof import('@/lib/icu/endpunkte')

  beforeAll(async () => {
    process.env['TAKT_DATENBANK_URL'] = URL_
    process.env['ICU_API_KEY'] = 'probe'
    process.env['ICU_ATHLET_ID'] = 'i1'
    ;({ datenbank } = await import('@/lib/db'))
    p = await import('@/lib/daten/planvorschlaege')
    u = await import('./uebertragen')
    endpunkte = await import('@/lib/icu/endpunkte')
  })

  beforeEach(async () => {
    vi.mocked(endpunkte.planEintragen).mockReset()
    vi.mocked(endpunkte.planLoeschen).mockReset()
    await datenbank().execute(sql`delete from planvorschlaege where ziel like 'PROBE-%'`)
  })

  async function satzMit(
    einheiten: Parameters<typeof p.einheitenAnhaengen>[1],
  ): Promise<string[]> {
    const id = await p.vorschlagAnlegen({
      ziel: 'PROBE-Freigabe',
      vonTag: '2026-09-14',
      bisTag: '2026-11-08',
      wochen: 8,
    })
    await p.einheitenAnhaengen(id, einheiten)
    const satz = await p.vorschlagLesen(id)
    return satz?.einheiten.map((e) => e.id) ?? []
  }

  it('überträgt bei der Freigabe sofort und merkt sich die Kennung', async () => {
    vi.mocked(endpunkte.planEintragen).mockResolvedValue({ id: 'e99' })
    const [id] = await satzMit([{ tag: '2026-09-16', name: 'Langer Lauf' }])

    const ergebnis = await u.einheitUebertragen(id ?? '')
    expect(ergebnis.geglueckt).toBe(true)
    expect(endpunkte.planEintragen).toHaveBeenCalledTimes(1)

    const nachher = await p.einheitLesen(id ?? '')
    expect(nachher?.zustand).toBe('uebertragen')
    expect(nachher?.icuEventId).toBe('e99')
    expect(nachher?.fehler).toBeNull()
  })

  it('schickt genau die Nutzlast, die die Vorschau zeigt', async () => {
    vi.mocked(endpunkte.planEintragen).mockResolvedValue({ id: 'e1' })
    const [id] = await satzMit([
      {
        tag: '2026-09-16',
        name: '5 × 1000 m',
        beschreibung: 'Zielpace 3:45',
        dauerSekunden: 3600,
        streckeMeter: 12000,
        zielBelastung: 78,
      },
    ])
    const einheit = await p.einheitLesen(id ?? '')
    const { nutzlastText } = await import('./nutzlast')

    await u.einheitUebertragen(id ?? '')

    const gesendet = vi.mocked(endpunkte.planEintragen).mock.calls[0]?.[1]
    expect(gesendet).toEqual(JSON.parse(nutzlastText(einheit!)))
  })

  it('bleibt bei einem Fehlschlag auf freigegeben stehen und nennt den Grund', async () => {
    vi.mocked(endpunkte.planEintragen).mockRejectedValue(
      new Error('intervals.icu antwortete 403'),
    )
    const [id] = await satzMit([{ tag: '2026-09-16', name: 'Langer Lauf' }])

    const ergebnis = await u.einheitUebertragen(id ?? '')
    expect(ergebnis.geglueckt).toBe(false)
    expect(ergebnis.fehler).toContain('403')

    const nachher = await p.einheitLesen(id ?? '')
    expect(nachher?.zustand).toBe('freigegeben')
    expect(nachher?.fehler).toContain('403')
    expect(nachher?.icuEventId).toBeNull()
  })

  it('raeumt den alten Fehler weg, wenn der zweite Versuch klappt', async () => {
    vi.mocked(endpunkte.planEintragen).mockRejectedValueOnce(new Error('Netz weg'))
    const [id] = await satzMit([{ tag: '2026-09-16', name: 'Langer Lauf' }])
    await u.einheitUebertragen(id ?? '')
    expect((await p.einheitLesen(id ?? ''))?.fehler).toBe('Netz weg')

    vi.mocked(endpunkte.planEintragen).mockResolvedValue({ id: 'e2' })
    const zweiter = await u.einheitUebertragen(id ?? '')
    expect(zweiter.geglueckt).toBe(true)
    const nachher = await p.einheitLesen(id ?? '')
    expect(nachher?.fehler).toBeNull()
    expect(nachher?.zustand).toBe('uebertragen')
  })

  it('legt eine schon uebertragene Einheit kein zweites Mal an', async () => {
    vi.mocked(endpunkte.planEintragen).mockResolvedValue({ id: 'e3' })
    const [id] = await satzMit([{ tag: '2026-09-16', name: 'Langer Lauf' }])
    await u.einheitUebertragen(id ?? '')
    await u.einheitUebertragen(id ?? '')
    expect(endpunkte.planEintragen).toHaveBeenCalledTimes(1)
  })

  it('uebertraegt eine ersetzende Einheit nicht ohne eigene Bestaetigung', async () => {
    const [id] = await satzMit([
      { tag: '2026-09-16', name: 'Neu statt alt', ersetztPlanId: 'alt1' },
    ])
    const ergebnis = await u.einheitUebertragen(id ?? '')
    expect(ergebnis.geglueckt).toBe(false)
    expect(ergebnis.fehler).toContain('eigene')
    expect(endpunkte.planEintragen).not.toHaveBeenCalled()
    expect(endpunkte.planLoeschen).not.toHaveBeenCalled()
    // Der Zustand bleibt, wie er war — es ist nichts gescheitert, es wurde
    // nur nichts getan.
    expect((await p.einheitLesen(id ?? ''))?.zustand).toBe('vorschlag')
  })

  it('loescht die alte Einheit erst und legt dann die neue an', async () => {
    const reihenfolge: string[] = []
    vi.mocked(endpunkte.planLoeschen).mockImplementation(async () => {
      reihenfolge.push('loeschen')
    })
    vi.mocked(endpunkte.planEintragen).mockImplementation(async () => {
      reihenfolge.push('eintragen')
      return { id: 'e5' }
    })
    const [id] = await satzMit([
      { tag: '2026-09-16', name: 'Neu statt alt', ersetztPlanId: 'alt1' },
    ])

    const ergebnis = await u.einheitUebertragen(id ?? '', true)
    expect(ergebnis.geglueckt).toBe(true)
    expect(reihenfolge).toEqual(['loeschen', 'eintragen'])
  })

  it('loescht beim zweiten Versuch nicht noch einmal', async () => {
    // Der Fall, der die alte Einheit kosten wuerde: loeschen glueckt,
    // anlegen scheitert. Wuerde der zweite Versuch wieder loeschen, endete
    // er mit 404 — und die neue Einheit kaeme nie zustande.
    vi.mocked(endpunkte.planLoeschen).mockResolvedValue(undefined)
    vi.mocked(endpunkte.planEintragen).mockRejectedValueOnce(new Error('500 kaputt'))
    const [id] = await satzMit([
      { tag: '2026-09-16', name: 'Neu statt alt', ersetztPlanId: 'alt1' },
    ])

    const erster = await u.einheitUebertragen(id ?? '', true)
    expect(erster.geglueckt).toBe(false)
    expect(endpunkte.planLoeschen).toHaveBeenCalledTimes(1)
    expect((await p.einheitLesen(id ?? ''))?.ersetztGeloeschtAm).not.toBeNull()

    vi.mocked(endpunkte.planEintragen).mockResolvedValue({ id: 'e7' })
    const zweiter = await u.einheitUebertragen(id ?? '', true)
    expect(zweiter.geglueckt).toBe(true)
    // Kein zweites Loeschen.
    expect(endpunkte.planLoeschen).toHaveBeenCalledTimes(1)
  })

  it('nimmt die ersetzte Einheit auch aus dem eigenen Spiegel', async () => {
    vi.mocked(endpunkte.planLoeschen).mockResolvedValue(undefined)
    vi.mocked(endpunkte.planEintragen).mockResolvedValue({ id: 'e8' })

    await datenbank().execute(
      sql`insert into plan (id, tag, name) values ('PROBE-alt', '2026-09-18', 'Alte Einheit')
          on conflict (id) do nothing`,
    )
    const [id] = await satzMit([
      { tag: '2026-09-18', name: 'Neu statt alt', ersetztPlanId: 'PROBE-alt' },
    ])

    await u.einheitUebertragen(id ?? '', true)

    const rest = await datenbank().execute(
      sql`select count(*)::int as anzahl from plan where id = 'PROBE-alt'`,
    )
    // Der Abgleich raeumt nichts weg, was drueben verschwunden ist — sonst
    // stuende die alte Einheit fuer immer im Wochenraster.
    expect((rest.rows[0] as { anzahl: number }).anzahl).toBe(0)
  })

  it('legt nichts an, wenn schon das Loeschen scheitert', async () => {
    vi.mocked(endpunkte.planLoeschen).mockRejectedValue(new Error('404 nicht gefunden'))
    const [id] = await satzMit([
      { tag: '2026-09-16', name: 'Neu statt alt', ersetztPlanId: 'alt1' },
    ])

    const ergebnis = await u.einheitUebertragen(id ?? '', true)
    expect(ergebnis.geglueckt).toBe(false)
    expect(endpunkte.planEintragen).not.toHaveBeenCalled()
    expect((await p.einheitLesen(id ?? ''))?.zustand).toBe('freigegeben')
  })

  it('ueberspringt ersetzende Einheiten bei «Alle freigeben»', async () => {
    vi.mocked(endpunkte.planEintragen).mockResolvedValue({ id: 'e6' })
    const ids = await satzMit([
      { tag: '2026-09-16', name: 'Normal' },
      { tag: '2026-09-17', name: 'Ersetzt', ersetztPlanId: 'alt1' },
      { tag: '2026-09-18', name: 'Auch normal' },
    ])

    const ergebnis = await u.einheitenUebertragen(ids)
    expect(ergebnis.uebertragen).toHaveLength(2)
    expect(ergebnis.uebersprungen).toHaveLength(1)
    expect(endpunkte.planLoeschen).not.toHaveBeenCalled()
  })

  it('uebertraegt eine verworfene Einheit nicht', async () => {
    const [id] = await satzMit([{ tag: '2026-09-16', name: 'Weg damit' }])
    await p.einheitVerwerfen(id ?? '')
    const ergebnis = await u.einheitUebertragen(id ?? '')
    expect(ergebnis.geglueckt).toBe(false)
    expect(endpunkte.planEintragen).not.toHaveBeenCalled()
  })
})
