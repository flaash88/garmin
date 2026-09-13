import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'

/**
 * Der Punkt, um den es hier geht: ein Faden muss ein Neuladen überleben und
 * beim Wiederöffnen aussehen wie beim ersten Mal — samt Werkzeugzeilen.
 * Das lässt sich nicht gegen eine Attrappe zeigen, nur gegen eine echte
 * Datenbank.
 *
 * Ohne TAKT_TEST_DATENBANK_URL wird die Reihe übersprungen statt rot zu sein.
 */
const URL_ = process.env['TAKT_TEST_DATENBANK_URL']
const wenn = URL_ ? describe : describe.skip

wenn('Unterhaltungen in der Datenbank', () => {
  let datenbank: typeof import('@/lib/db').datenbank
  let schema: typeof import('@/lib/db/schema')
  let u: typeof import('./unterhaltungen')

  beforeAll(async () => {
    process.env['TAKT_DATENBANK_URL'] = URL_
    ;({ datenbank } = await import('@/lib/db'))
    schema = await import('@/lib/db/schema')
    u = await import('./unterhaltungen')
  })

  beforeEach(async () => {
    // Nur die Fäden dieser Reihe, nicht die Tabelle: andere Testdateien
    // arbeiten auf derselben Datenbank.
    await datenbank().execute(
      sql`delete from unterhaltungen where titel like 'PROBE-%'`,
    )
  })

  it('legt einen Faden an und liest ihn samt Werkzeugzeilen zurueck', async () => {
    const id = await u.unterhaltungBeginnen('PROBE-Wie war meine Woche?')
    await u.nachrichtAblegen(id, {
      rolle: 'du',
      text: 'PROBE-Wie war meine Woche?',
      werkzeuge: [],
      zugang: null,
      fehler: null,
    })
    await u.nachrichtAblegen(id, {
      rolle: 'coach',
      text: 'Ordentlich.',
      werkzeuge: [
        { beschriftung: 'Aktivitäten geladen', detail: '31 Einheiten · 218,4 km' },
      ],
      zugang: null,
      fehler: null,
    })

    const gelesen = await u.unterhaltungLesen(id)
    expect(gelesen).not.toBeNull()
    expect(gelesen?.unterhaltung.titel).toBe('PROBE-Wie war meine Woche?')
    expect(gelesen?.nachrichten).toHaveLength(2)
    expect(gelesen?.nachrichten[0]?.rolle).toBe('du')
    expect(gelesen?.nachrichten[1]?.text).toBe('Ordentlich.')
    // Die Werkzeugzeile von damals, nicht neu erfunden.
    expect(gelesen?.nachrichten[1]?.werkzeuge).toEqual([
      { beschriftung: 'Aktivitäten geladen', detail: '31 Einheiten · 218,4 km' },
    ])
  })

  it('behaelt die Reihenfolge auch bei vielen Zuegen', async () => {
    const id = await u.unterhaltungBeginnen('PROBE-Reihenfolge')
    for (let i = 0; i < 12; i++) {
      await u.nachrichtAblegen(id, {
        rolle: i % 2 === 0 ? 'du' : 'coach',
        text: `Zug ${i}`,
        werkzeuge: [],
        zugang: null,
        fehler: null,
      })
    }
    const gelesen = await u.unterhaltungLesen(id)
    expect(gelesen?.nachrichten.map((n) => n.text)).toEqual(
      Array.from({ length: 12 }, (_, i) => `Zug ${i}`),
    )
  })

  it('haelt Fehler und Zugangsmeldung getrennt', async () => {
    const id = await u.unterhaltungBeginnen('PROBE-Fehler')
    await u.nachrichtAblegen(id, {
      rolle: 'coach',
      text: '',
      werkzeuge: [],
      zugang: 'Zugang abgelaufen',
      fehler: null,
    })
    await u.nachrichtAblegen(id, {
      rolle: 'coach',
      text: '',
      werkzeuge: [],
      zugang: null,
      fehler: 'Netz weg',
    })
    const gelesen = await u.unterhaltungLesen(id)
    expect(gelesen?.nachrichten[0]?.zugang).toBe('Zugang abgelaufen')
    expect(gelesen?.nachrichten[0]?.fehler).toBeNull()
    expect(gelesen?.nachrichten[1]?.fehler).toBe('Netz weg')
    expect(gelesen?.nachrichten[1]?.zugang).toBeNull()
  })

  it('sortiert die Liste nach der letzten Regung', async () => {
    const alt = await u.unterhaltungBeginnen('PROBE-alt')
    const neu = await u.unterhaltungBeginnen('PROBE-neu')
    // Den alten Faden wieder anfassen — er muss dadurch nach oben rutschen.
    await u.nachrichtAblegen(alt, {
      rolle: 'du',
      text: 'noch was',
      werkzeuge: [],
      zugang: null,
      fehler: null,
    })
    const liste = (await u.unterhaltungenListe()).filter((x) =>
      x.titel.startsWith('PROBE-'),
    )
    expect(liste.map((x) => x.id).slice(0, 2)).toEqual([alt, neu])
  })

  it('loescht den Faden samt Nachrichten', async () => {
    const id = await u.unterhaltungBeginnen('PROBE-loeschen')
    await u.nachrichtAblegen(id, {
      rolle: 'du',
      text: 'weg damit',
      werkzeuge: [],
      zugang: null,
      fehler: null,
    })
    await u.unterhaltungLoeschen(id)
    expect(await u.unterhaltungLesen(id)).toBeNull()
    const rest = await datenbank().execute(
      sql`select count(*)::int as anzahl from nachrichten where unterhaltung_id = ${id}`,
    )
    expect((rest.rows[0] as { anzahl: number }).anzahl).toBe(0)
  })

  it('meldet einen unbekannten Faden als nicht vorhanden', async () => {
    expect(await u.unterhaltungLesen('gibt-es-nicht')).toBeNull()
  })
})
