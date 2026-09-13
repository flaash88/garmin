import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Gegen die echte Rolle, nicht gegen eine Attrappe. Die Schranken liegen in
 * der Datenbank; ein Test gegen eine Nachbildung würde genau das nicht prüfen.
 */
const URL_ = process.env['TAKT_TEST_SQL_ROLLE_URL']
/** Zum Anlegen der Probedaten — der Coach selbst darf nicht schreiben. */
const EIGENTUEMER = process.env['TAKT_TEST_DATENBANK_URL']
const wenn = URL_ && EIGENTUEMER ? describe : describe.skip

wenn('sqlAusfuehren gegen die Rolle takt_coach', () => {
  let sqlAusfuehren: typeof import('./sql-ausfuehren').sqlAusfuehren
  let AbfrageAbgewiesen: typeof import('./sql-ausfuehren').AbfrageAbgewiesen

  beforeAll(async () => {
    process.env['TAKT_SQL_ROLLE_URL'] = URL_
    const m = await import('./sql-ausfuehren')
    sqlAusfuehren = m.sqlAusfuehren
    AbfrageAbgewiesen = m.AbfrageAbgewiesen

    /*
     * Eigene Probezeile anlegen, statt auf Bestand zu hoffen. Die
     * Integrationstests aus Phase 3 leeren dieselben Tabellen; ein Test,
     * der auf fremde Daten baut, faellt um, sobald die Reihenfolge wechselt.
     */
    const { Pool } = await import('pg')
    const p = new Pool({ connectionString: EIGENTUEMER, max: 1 })
    try {
      await p.query(`
        insert into aktivitaeten (id, beginn, name, typ, dauer_sekunden, strecke_meter, belastung, rohdaten)
        values ('coach-probe', '2026-09-13T06:45:00Z', 'Probelauf für den Coach', 'Run', 2400, 10000, 55, '{"geheim":"darf der Coach nicht sehen"}'::jsonb)
        on conflict (id) do update set name = excluded.name`)
    } finally {
      await p.end()
    }
  })

  it('liest die eigene Probezeile aus dem Auswertungsschema', async () => {
    const e = await sqlAusfuehren(
      "select name, strecke_meter from aktivitaeten where id = 'coach-probe'",
    )
    expect(e.zeilen).toHaveLength(1)
    expect(e.zeilen[0]?.[0]).toBe('Probelauf für den Coach')
    expect(Number(e.zeilen[0]?.[1])).toBe(10000)
  })

  it('sieht die Spalte rohdaten nicht — sie steht in keiner View', async () => {
    // Der Rohsatz traegt die vollstaendige Antwort von intervals.icu. Was
    // darin steht, wissen wir nicht sicher, also kommt er nicht ins
    // Auswertungsschema.
    await expect(sqlAusfuehren('select rohdaten from aktivitaeten limit 1'))
      .rejects.toThrow(/does not exist|existiert nicht/i)
  })

  it('loest unqualifizierte Namen im Auswertungsschema auf, nicht in public', async () => {
    // Die View traegt keine Spalte rohdaten. Kaeme public.aktivitaeten
    // durch, gaebe es sie.
    const e = await sqlAusfuehren('select * from aktivitaeten limit 1')
    expect(e.spalten).not.toContain('rohdaten')
    expect(e.spalten).toContain('pace_sekunden_je_km')
  })

  it('kommt nicht an public heran', async () => {
    await expect(sqlAusfuehren('select * from public.aktivitaeten limit 1'))
      .rejects.toThrow(/permission denied|does not exist/i)
  })

  it('kommt nicht an die Passwort-Hashes heran', async () => {
    await expect(sqlAusfuehren('select rolname, rolpassword from pg_authid'))
      .rejects.toThrow(/permission denied/i)
  })

  it('kappt die Zeilenzahl und sagt es', async () => {
    const e = await sqlAusfuehren('select generate_series(1, 5000) as n')
    expect(e.zeilen.length).toBe(500)
    expect(e.gekappt).toBe(true)
  })

  it('meldet ungekappt, wenn das Ergebnis hineinpasst', async () => {
    const e = await sqlAusfuehren('select generate_series(1, 10) as n')
    expect(e.zeilen.length).toBe(10)
    expect(e.gekappt).toBe(false)
  })

  it('bricht nach fuenf Sekunden ab', async () => {
    // pg_sleep waere von der Wache abgewiesen, deshalb echte Arbeit:
    // ein Kreuzprodukt, das laenger braucht als die Schranke erlaubt.
    const begonnen = Date.now()
    await expect(
      sqlAusfuehren(
        'select count(*) from generate_series(1,400000) a, generate_series(1,400000) b',
      ),
    ).rejects.toThrow(/timeout|abgebrochen|canceling/i)
    // Mit Reserve fuer Verbindungsaufbau.
    expect(Date.now() - begonnen).toBeLessThan(12_000)
  }, 20_000)

  it('weist mehrere Anweisungen ab, bevor die Datenbank sie sieht', async () => {
    await expect(sqlAusfuehren('select 1; set statement_timeout = 0'))
      .rejects.toBeInstanceOf(AbfrageAbgewiesen)
  })

  it('weist ein schreibendes CTE ab', async () => {
    await expect(
      sqlAusfuehren('with w as (delete from plan returning id) select * from w'),
    ).rejects.toBeInstanceOf(AbfrageAbgewiesen)
  })

  it('laesst auch ohne Wache nichts durch: die Datenbank weist Schreiben ab', async () => {
    /*
     * Der wichtigste Test der Reihe. Er umgeht die Wache absichtlich und
     * spricht die Datenbank unmittelbar an — wenn die zweite Schranke je
     * faellt, muss die erste allein tragen.
     */
    const { Pool } = await import('pg')
    const p = new Pool({ connectionString: URL_, max: 1 })
    try {
      await expect(p.query('create table auswertung.eingeschmuggelt(x int)'))
        .rejects.toThrow(/permission denied|read-only/i)
      await expect(p.query("insert into auswertung.plan(id, tag) values ('x','2026-01-01')"))
        .rejects.toThrow(/permission denied|read-only/i)
      await expect(p.query('select * from public.wellness limit 1'))
        .rejects.toThrow(/permission denied/i)
    } finally {
      await p.end()
    }
  })
})
