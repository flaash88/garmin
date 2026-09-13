import { asc, desc, eq } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { nachrichten, unterhaltungen } from '@/lib/db/schema'

/**
 * Gesprächsfäden mit dem Coach.
 *
 * Lagen bisher nur im Zustand der Oberfläche und waren nach einem Neuladen
 * weg. Jetzt in der Datenbank — damit sie auch einen Neubau des Behälters
 * überstehen.
 */

export interface Werkzeugzeile {
  beschriftung: string
  detail: string | null
}

export interface Nachricht {
  id: string
  rolle: 'du' | 'coach'
  text: string
  werkzeuge: Werkzeugzeile[]
  zugang: string | null
  fehler: string | null
  erstelltAm: Date
}

export interface Unterhaltung {
  id: string
  titel: string
  begonnenAm: Date
  zuletztAm: Date
}

/** Titel aus der ersten Frage. Eine Zeile, höchstens 80 Zeichen. */
export function titelAus(frage: string): string {
  const eine = frage.replaceAll(/\s+/g, ' ').trim()
  if (eine.length === 0) return 'Ohne Titel'
  if (eine.length <= 80) return eine
  // An einer Wortgrenze kürzen, nicht mitten im Wort.
  const gekuerzt = eine.slice(0, 80)
  const luecke = gekuerzt.lastIndexOf(' ')
  return (luecke > 40 ? gekuerzt.slice(0, luecke) : gekuerzt) + '…'
}

function kennung(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function unterhaltungenListe(grenze = 40): Promise<Unterhaltung[]> {
  const zeilen = await datenbank()
    .select()
    .from(unterhaltungen)
    .orderBy(desc(unterhaltungen.zuletztAm))
    .limit(grenze)
  return zeilen
}

export async function unterhaltungLesen(
  id: string,
): Promise<{ unterhaltung: Unterhaltung; nachrichten: Nachricht[] } | null> {
  const kopf = await datenbank()
    .select()
    .from(unterhaltungen)
    .where(eq(unterhaltungen.id, id))
    .limit(1)
  if (!kopf[0]) return null

  const zeilen = await datenbank()
    .select()
    .from(nachrichten)
    .where(eq(nachrichten.unterhaltungId, id))
    .orderBy(asc(nachrichten.reihenfolge))

  return {
    unterhaltung: kopf[0],
    nachrichten: zeilen.map((z) => ({
      id: z.id,
      rolle: z.rolle === 'du' ? 'du' : 'coach',
      text: z.text,
      werkzeuge: Array.isArray(z.werkzeuge) ? (z.werkzeuge as Werkzeugzeile[]) : [],
      zugang: z.zugang,
      fehler: z.fehler,
      erstelltAm: z.erstelltAm,
    })),
  }
}

export async function unterhaltungBeginnen(ersteFrage: string): Promise<string> {
  const id = kennung()
  await datenbank().insert(unterhaltungen).values({ id, titel: titelAus(ersteFrage) })
  return id
}

export async function nachrichtAblegen(
  unterhaltungId: string,
  nachricht: Omit<Nachricht, 'id' | 'erstelltAm'>,
): Promise<string> {
  // Nächste Nummer im Faden: eine mehr als die höchste bisherige.
  const bisher = await datenbank()
    .select({ reihenfolge: nachrichten.reihenfolge })
    .from(nachrichten)
    .where(eq(nachrichten.unterhaltungId, unterhaltungId))
    .orderBy(desc(nachrichten.reihenfolge))
    .limit(1)

  const id = kennung()
  await datenbank().insert(nachrichten).values({
    id,
    unterhaltungId,
    rolle: nachricht.rolle,
    text: nachricht.text,
    werkzeuge: nachricht.werkzeuge,
    zugang: nachricht.zugang,
    fehler: nachricht.fehler,
    reihenfolge: (bisher[0]?.reihenfolge ?? -1) + 1,
  })

  await datenbank()
    .update(unterhaltungen)
    .set({ zuletztAm: new Date() })
    .where(eq(unterhaltungen.id, unterhaltungId))

  return id
}

export async function unterhaltungLoeschen(id: string): Promise<void> {
  // Die Nachrichten gehen über onDelete: 'cascade' mit.
  await datenbank().delete(unterhaltungen).where(eq(unterhaltungen.id, id))
}
