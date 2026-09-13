import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

/**
 * Die Verbindung wird beim **ersten Zugriff** aufgebaut, nicht beim Laden des
 * Moduls. Sonst bräuchte schon `next build` eine laufende Datenbank: Next
 * wertet beim Sammeln der Seitendaten jedes Modul aus, das eine Route
 * einführt, und ein Wurf auf Modulebene lässt den Build scheitern.
 */

const global_ = globalThis as unknown as {
  taktPool?: Pool
  taktDb?: NodePgDatabase<typeof schema>
}

function verbindung(): string {
  const url = process.env['TAKT_DATENBANK_URL']
  if (!url) {
    throw new Error('TAKT_DATENBANK_URL ist nicht gesetzt. Siehe .env.beispiel.')
  }
  return url
}

export function datenbank(): NodePgDatabase<typeof schema> {
  if (global_.taktDb) return global_.taktDb

  const pool = global_.taktPool ?? new Pool({ connectionString: verbindung() })

  // Ohne diesen Zuhörer beendet ein Fehler auf einer ruhenden Verbindung —
  // ein Neustart von PostgreSQL genügt — den Serverprozess. Der Pool ersetzt
  // die Verbindung von selbst, gemeldet wird der Fehler trotzdem.
  if (pool.listenerCount('error') === 0) {
    pool.on('error', (fehler) => {
      console.error('[takt] Fehler auf ruhender Datenbankverbindung:', fehler)
    })
  }

  const db = drizzle(pool, { schema })

  // Im Entwicklungsbetrieb überleben Pool und Instanz das Neuladen der
  // Module, damit nicht bei jeder Änderung neue Verbindungen aufgehen.
  global_.taktPool = pool
  global_.taktDb = db
  return db
}

export { schema }
