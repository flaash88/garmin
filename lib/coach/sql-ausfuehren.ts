import { Pool } from 'pg'
import { HOECHSTZEILEN, sqlPruefen, ZEITSCHRANKE_MS } from './sql-wache'

/**
 * Führt eine Abfrage des Coach aus — unter der Rolle `takt_coach`, in einer
 * ausdrücklichen Lesetransaktion, mit einer Zeitschranke, die der Coach nicht
 * aufheben kann.
 *
 * Warum die Transaktion und `SET LOCAL`, obwohl die Rolle beides schon als
 * Vorgabe trägt: die Rolle **darf ihre eigene Zeitschranke aufheben**
 * (`SET statement_timeout = 0` geht durch, nachgewiesen in E5.2). Gesetzt wird
 * sie deshalb hier, nach dem Verbindungsaufbau, als `SET LOCAL` innerhalb der
 * Transaktion — und die Wache lässt keine zweite Anweisung zu, mit der sie
 * sich wieder ändern liesse.
 */

const global_ = globalThis as unknown as { taktCoachPool?: Pool }

function pool(): Pool {
  if (global_.taktCoachPool) return global_.taktCoachPool

  const url = process.env['TAKT_SQL_ROLLE_URL']
  if (!url) {
    throw new Error(
      'TAKT_SQL_ROLLE_URL ist nicht gesetzt. Der Coach braucht eine eigene ' +
        'Postgres-Rolle mit ausschließlich SELECT auf das Auswertungsschema. ' +
        'Siehe datenbank/einrichten.sh.',
    )
  }

  const p = new Pool({
    connectionString: url,
    max: 2,
    // Der Coach soll den Hauptbetrieb nicht ausbremsen.
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10_000,
  })
  if (p.listenerCount('error') === 0) {
    p.on('error', (fehler) => {
      console.error('[takt] Fehler auf ruhender Coach-Verbindung:', fehler)
    })
  }
  global_.taktCoachPool = p
  return p
}

export interface AbfrageErgebnis {
  spalten: string[]
  zeilen: unknown[][]
  /** Ob die Zeilenzahl gekappt wurde. */
  gekappt: boolean
  dauerMs: number
}

export class AbfrageAbgewiesen extends Error {}

export async function sqlAusfuehren(roh: string): Promise<AbfrageErgebnis> {
  const wache = sqlPruefen(roh)
  if (!wache.erlaubt) throw new AbfrageAbgewiesen(wache.grund ?? 'Abgewiesen.')

  const sql = roh.trim().replace(/;\s*$/, '')
  const begonnen = Date.now()

  const verbindung = await pool().connect()
  try {
    await verbindung.query('BEGIN TRANSACTION READ ONLY')
    await verbindung.query(`SET LOCAL statement_timeout = ${ZEITSCHRANKE_MS}`)
    // Auch die Zahl der Zeilen wird in der Datenbank begrenzt, nicht erst
    // hier — sonst zöge eine Abfrage über den ganzen Bestand erst den
    // Arbeitsspeicher voll und würde dann gekürzt.
    const ergebnis = await verbindung.query({
      text: `SELECT * FROM (${sql}) AS coach_abfrage LIMIT ${HOECHSTZEILEN + 1}`,
      rowMode: 'array',
    })

    const alle = ergebnis.rows as unknown[][]
    const gekappt = alle.length > HOECHSTZEILEN

    return {
      spalten: ergebnis.fields.map((f) => f.name),
      zeilen: gekappt ? alle.slice(0, HOECHSTZEILEN) : alle,
      gekappt,
      dauerMs: Date.now() - begonnen,
    }
  } finally {
    // Immer zurückrollen. Geschrieben wurde nichts, aber eine offene
    // Transaktion hielte sonst eine Verbindung fest.
    await verbindung.query('ROLLBACK').catch(() => {})
    verbindung.release()
  }
}

/**
 * Prüft beim Hochfahren, ob die Verbindung als `takt_coach` steht.
 *
 * Im Betrieb fiel das erst im Chat auf — «password authentication failed for
 * user takt_coach» —, weil die Rolle nie angelegt worden war. Jetzt steht es
 * beim Start im Protokoll.
 */
export async function coachRolleStartmeldung(): Promise<string | null> {
  if (!process.env['TAKT_SQL_ROLLE_URL']) {
    return (
      'TAKT_SQL_ROLLE_URL ist nicht gesetzt. Der Coach kann kein SQL abfragen, ' +
      'alles andere läuft.\n' +
      '  Anlegen mit: TAKT_COACH_PASSWORT=… bash datenbank/einrichten.sh'
    )
  }

  try {
    await sqlAusfuehren('select 1 as pruefung')
    return null
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
    return (
      `Die Verbindung als takt_coach steht nicht: ${text}\n` +
      '  Der Coach wird bei sql_abfrage scheitern; die übrigen Werkzeuge laufen.\n' +
      '  Rolle anlegen oder Passwort angleichen: datenbank/hochfahren.sh'
    )
  }
}
