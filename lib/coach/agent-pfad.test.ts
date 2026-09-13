import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { falscheApiStarten, type FalscheApi, type Schritt } from './proben/falsche-api'
import type { CoachEreignis, Werkzeugentscheidung } from './agent'

/**
 * Prüft die Schranken des Coach über den **echten Agentenpfad**.
 *
 * Der Anlass: `canUseTool` wurde im Betrieb für alle sieben eigenen Werkzeuge
 * übersprungen, weil nackte Namen in `allowedTools` sie vorab genehmigten. Die
 * bisherigen Tests riefen den Rückruf unmittelbar auf und waren deshalb grün —
 * sie prüften die Funktion, nicht den Pfad. Siehe DECISIONS.md, E9.1.
 *
 * Hier läuft der echte Agent. Nachgebaut ist nur das Modell dahinter.
 */

const DATENBANK = process.env['TAKT_TEST_DATENBANK_URL']
const ROLLE = process.env['TAKT_TEST_SQL_ROLLE_URL']
const wenn = DATENBANK && ROLLE ? describe : describe.skip

interface Lauf {
  ereignisse: CoachEreignis[]
  entscheidungen: Werkzeugentscheidung[]
  warnungen: Array<{ code: string | undefined; text: string }>
  angeboteneWerkzeuge: string[]
}

wenn('Coach über den Agentenpfad', () => {
  let coachFragen: typeof import('./agent').coachFragen
  let offen: FalscheApi | null = null

  beforeAll(async () => {
    process.env['TAKT_DATENBANK_URL'] = DATENBANK
    process.env['TAKT_SQL_ROLLE_URL'] = ROLLE
    process.env['CLAUDE_CODE_OAUTH_TOKEN'] = 'sk-ant-oat01-' + 'x'.repeat(60)
    ;({ coachFragen } = await import('./agent'))
  })

  afterEach(async () => {
    await offen?.schliessen()
    offen = null
  })

  async function laufen(drehbuch: Schritt[], frage = 'Wie war meine Woche?'): Promise<Lauf> {
    const api = await falscheApiStarten(drehbuch)
    offen = api
    process.env['ANTHROPIC_BASE_URL'] = api.adresse

    const warnungen: Lauf['warnungen'] = []
    const horcher = (w: Error & { code?: string }) => {
      warnungen.push({ code: w.code, text: w.message })
    }
    process.on('warning', horcher)

    const ereignisse: CoachEreignis[] = []
    const entscheidungen: Werkzeugentscheidung[] = []
    try {
      for await (const e of coachFragen(frage, [], (d) => entscheidungen.push(d))) {
        ereignisse.push(e)
      }
    } finally {
      process.off('warning', horcher)
    }

    return {
      ereignisse,
      entscheidungen,
      warnungen,
      angeboteneWerkzeuge: api.mitschrift.angeboteneWerkzeuge,
    }
  }

  function werkzeugzeilen(l: Lauf) {
    return l.ereignisse.filter((e) => e.art === 'werkzeug')
  }

  it('warnt nicht mehr, dass canUseTool verschattet wird', async () => {
    const l = await laufen([{ art: 'text', text: 'fertig' }])
    const verschattet = l.warnungen.filter(
      (w) => w.code === 'CLAUDE_SDK_CAN_USE_TOOL_SHADOWED',
    )
    expect(verschattet, JSON.stringify(verschattet)).toHaveLength(0)
  }, 120_000)

  it('fragt canUseTool auch für die eigenen Werkzeuge', async () => {
    // Der Kern des Befunds: vorher kam hier nichts an.
    const l = await laufen([
      { art: 'werkzeug', name: 'mcp__takt__ausruestung' },
      { art: 'text', text: 'fertig' },
    ])
    expect(l.entscheidungen).toContainEqual({
      name: 'mcp__takt__ausruestung',
      erlaubt: true,
    })
  }, 120_000)

  it('bietet dem Modell genau die sieben eigenen Werkzeuge an', async () => {
    const l = await laufen([{ art: 'text', text: 'fertig' }])
    const fremde = l.angeboteneWerkzeuge.filter((w) => !w.startsWith('mcp__takt__'))
    expect(fremde, `fremde Werkzeuge: ${fremde.join(', ')}`).toHaveLength(0)
    expect(l.angeboteneWerkzeuge).toHaveLength(7)
  }, 120_000)

  it('lässt Bash nicht einmal bis zur Genehmigung kommen', async () => {
    const l = await laufen([
      { art: 'werkzeug', name: 'Bash', eingabe: { command: 'cat /home/user/garmin/.env' } },
      { art: 'text', text: 'fertig' },
    ])
    // tools: [] entfernt es schon aus dem Angebot; der Rückruf sieht es gar nicht.
    expect(l.entscheidungen.map((d) => d.name)).not.toContain('Bash')
    expect(l.angeboteneWerkzeuge).not.toContain('Bash')
  }, 120_000)

  it('lässt ein fremdes MCP-Werkzeug nicht laufen', async () => {
    const l = await laufen([
      { art: 'werkzeug', name: 'mcp__fremd__datei_lesen', eingabe: { pfad: '/etc/passwd' } },
      { art: 'text', text: 'fertig' },
    ])
    expect(werkzeugzeilen(l)).toHaveLength(0)
  }, 120_000)

  describe('die Wache vor sql_abfrage greift auf diesem Weg', () => {
    it('weist mehrere Anweisungen ab', async () => {
      const l = await laufen([
        {
          art: 'werkzeug',
          name: 'mcp__takt__sql_abfrage',
          eingabe: { sql: 'select 1 as a; drop table aktivitaeten' },
        },
        { art: 'text', text: 'fertig' },
      ])
      const zeile = werkzeugzeilen(l)[0]
      expect(zeile?.beschriftung).toBe('SQL-Abfrage abgewiesen')
      expect(zeile?.detail).toContain('Nur eine Anweisung')
    }, 120_000)

    it('weist ein schreibendes CTE ab', async () => {
      const l = await laufen([
        {
          art: 'werkzeug',
          name: 'mcp__takt__sql_abfrage',
          eingabe: { sql: 'with weg as (delete from plan returning id) select * from weg' },
        },
        { art: 'text', text: 'fertig' },
      ])
      const zeile = werkzeugzeilen(l)[0]
      expect(zeile?.beschriftung).toBe('SQL-Abfrage abgewiesen')
      expect(zeile?.detail).toContain('DELETE')
    }, 120_000)

    it('lässt eine harmlose Abfrage durch', async () => {
      const l = await laufen([
        {
          art: 'werkzeug',
          name: 'mcp__takt__sql_abfrage',
          eingabe: { sql: 'select count(*) as n from aktivitaeten' },
        },
        { art: 'text', text: 'fertig' },
      ])
      const zeile = werkzeugzeilen(l)[0]
      expect(zeile?.beschriftung).toBe('SQL-Abfrage ausgeführt')
      expect(zeile?.detail).toMatch(/1 Zeilen · 1 Spalten/)
    }, 120_000)

    it('kommt über sql_abfrage nicht an public heran', async () => {
      const l = await laufen([
        {
          art: 'werkzeug',
          name: 'mcp__takt__sql_abfrage',
          eingabe: { sql: 'select * from public.wellness limit 1' },
        },
        { art: 'text', text: 'fertig' },
      ])
      const zeile = werkzeugzeilen(l)[0]
      expect(zeile?.beschriftung).toBe('SQL-Abfrage fehlgeschlagen')
      expect(zeile?.detail).toMatch(/permission denied/i)
    }, 120_000)
  })
})
