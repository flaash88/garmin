import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

function verbindung(): string {
  const url = process.env['TAKT_DATENBANK_URL']
  if (!url) {
    throw new Error(
      'TAKT_DATENBANK_URL ist nicht gesetzt. Siehe .env.beispiel.',
    )
  }
  return url
}

// Im Entwicklungsbetrieb überlebt der Pool das Neuladen der Module, damit
// nicht bei jeder Änderung neue Verbindungen aufgemacht werden.
const global_ = globalThis as unknown as { taktPool?: Pool }

const pool = global_.taktPool ?? new Pool({ connectionString: verbindung() })

// Ohne diesen Zuhörer beendet ein Fehler auf einer ruhenden Verbindung — ein
// Neustart von PostgreSQL genügt — den Serverprozess. Der Pool ersetzt die
// Verbindung von selbst, gemeldet wird der Fehler trotzdem.
if (pool.listenerCount('error') === 0) {
  pool.on('error', (fehler) => {
    console.error('[takt] Fehler auf ruhender Datenbankverbindung:', fehler)
  })
}

if (process.env.NODE_ENV !== 'production') global_.taktPool = pool

export const db = drizzle(pool, { schema })
export { schema }
