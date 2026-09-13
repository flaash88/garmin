import { desc } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { abgleich } from '@/lib/db/schema'

export interface AbgleichStandDaten {
  zuletztAm: Date
  fehler: string | null
}

/**
 * Der jüngste Abgleich über alle Quellen. Scheiterte irgendeine Quelle beim
 * letzten Versuch, gilt der Stand als fehlerhaft — lieber einmal zu viel
 * gewarnt als stillschweigend veraltete Zahlen zeigen.
 */
export async function letzterAbgleich(): Promise<AbgleichStandDaten | null> {
  const zeilen = await datenbank()
    .select()
    .from(abgleich)
    .orderBy(desc(abgleich.zuletztAm))

  const mitZeit = zeilen.filter((z) => z.zuletztAm !== null)
  if (mitZeit.length === 0) return null

  const juengste = mitZeit[0]
  if (!juengste?.zuletztAm) return null

  const fehler = mitZeit.find((z) => z.zuletztFehler !== null)?.zuletztFehler ?? null
  return { zuletztAm: juengste.zuletztAm, fehler }
}
