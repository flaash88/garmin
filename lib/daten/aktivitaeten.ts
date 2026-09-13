import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { aktivitaeten, strecken, streckenZuordnung, verlaeufe } from '@/lib/db/schema'

export type AktivitaetZeile = typeof aktivitaeten.$inferSelect

export const SEITENGROESSE = 25

export async function aktivitaetenSeite(seite = 0): Promise<{
  zeilen: AktivitaetZeile[]
  gesamt: number
}> {
  const [anzahl] = await datenbank()
    .select({ n: sql<string>`count(*)` })
    .from(aktivitaeten)

  const zeilen = await datenbank()
    .select()
    .from(aktivitaeten)
    .orderBy(desc(aktivitaeten.beginn))
    .limit(SEITENGROESSE)
    .offset(seite * SEITENGROESSE)

  return { zeilen, gesamt: Number(anzahl?.n ?? 0) || 0 }
}

export async function aktivitaet(id: string): Promise<AktivitaetZeile | null> {
  const zeilen = await datenbank()
    .select()
    .from(aktivitaeten)
    .where(eq(aktivitaeten.id, id))
    .limit(1)
  return zeilen[0] ?? null
}

/** Der Verlauf liegt erst vor, wenn die Aktivität einmal geöffnet wurde. */
export async function verlaufAusCache(id: string): Promise<unknown | null> {
  const zeilen = await datenbank()
    .select()
    .from(verlaeufe)
    .where(eq(verlaeufe.aktivitaetId, id))
    .limit(1)
  return zeilen[0]?.daten ?? null
}

export async function streckeZurAktivitaet(id: string) {
  const zeilen = await datenbank()
    .select({ strecke: strecken, abstand: streckenZuordnung.mittlererAbstandMeter })
    .from(streckenZuordnung)
    .innerJoin(strecken, eq(strecken.id, streckenZuordnung.streckeId))
    .where(eq(streckenZuordnung.aktivitaetId, id))
    .limit(1)
  return zeilen[0] ?? null
}

/** Suche über Name und Notizen. Zwei Zeichen Mindestlänge prüft der Aufrufer. */
export async function suchen(frage: string, grenze = 12): Promise<AktivitaetZeile[]> {
  const muster = `%${frage.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
  return datenbank()
    .select()
    .from(aktivitaeten)
    .where(
      or(
        ilike(aktivitaeten.name, muster),
        ilike(aktivitaeten.typ, muster),
        sql`${aktivitaeten.rohdaten}->>'description' ilike ${muster}`,
      ),
    )
    .orderBy(desc(aktivitaeten.beginn))
    .limit(grenze)
}

export async function aktivitaetenAb(ab: Date): Promise<AktivitaetZeile[]> {
  return datenbank()
    .select()
    .from(aktivitaeten)
    .where(and(gte(aktivitaeten.beginn, ab)))
    .orderBy(desc(aktivitaeten.beginn))
}
