import { verify } from '@node-rs/argon2'

/**
 * Läuft ausschließlich im Serverprozess — @node-rs/argon2 ist nativ und in
 * der Middleware (Edge) nicht verfügbar. Die Middleware prüft deshalb nur das
 * signierte Cookie, nie ein Passwort.
 */
export async function passwortStimmt(eingabe: string): Promise<boolean> {
  const hash = process.env['TAKT_PASSWORT_HASH']
  if (!hash) {
    throw new Error('TAKT_PASSWORT_HASH ist nicht gesetzt. Erzeugen mit: pnpm hash')
  }
  try {
    return await verify(hash, eingabe)
  } catch {
    // Ein unlesbarer Hash ist ein Einrichtungsfehler, kein Anmeldeversuch.
    // Nach außen bleibt es trotzdem bei der einen generischen Meldung.
    return false
  }
}
