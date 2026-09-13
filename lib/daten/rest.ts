import { desc, gte, lte, and } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { ausruestung, plan, strecken, wellness, zonen } from '@/lib/db/schema'
import { tagText } from './zeit'

export type WellnessZeile = typeof wellness.$inferSelect
export type PlanZeile = typeof plan.$inferSelect
export type StreckeZeile = typeof strecken.$inferSelect
export type AusruestungZeile = typeof ausruestung.$inferSelect
export type ZonenZeile = typeof zonen.$inferSelect

export async function naechte(anzahl = 14): Promise<WellnessZeile[]> {
  return datenbank().select().from(wellness).orderBy(desc(wellness.tag)).limit(anzahl)
}

export async function wellnessZeitraum(von: Date, bis: Date): Promise<WellnessZeile[]> {
  return datenbank()
    .select()
    .from(wellness)
    .where(and(gte(wellness.tag, tagText(von)), lte(wellness.tag, tagText(bis))))
    .orderBy(wellness.tag)
}

export async function planZeitraum(von: Date, bis: Date): Promise<PlanZeile[]> {
  return datenbank()
    .select()
    .from(plan)
    .where(and(gte(plan.tag, tagText(von)), lte(plan.tag, tagText(bis))))
    .orderBy(plan.tag)
}

export async function alleStrecken(): Promise<StreckeZeile[]> {
  return datenbank().select().from(strecken).orderBy(desc(strecken.anzahl))
}

export async function alleAusruestung(): Promise<AusruestungZeile[]> {
  return datenbank().select().from(ausruestung).orderBy(desc(ausruestung.laufleistungMeter))
}

export async function alleZonen(): Promise<ZonenZeile[]> {
  return datenbank().select().from(zonen)
}

/**
 * Welche Felder einer Quelle über den geholten Bestand nie befüllt waren.
 * Diese Felder werden in der Oberfläche ausgeblendet, nicht mit einem Strich
 * gezeigt — siehe DECISIONS.md, E0.8.
 */
export async function leereFelder(quelle: string): Promise<Set<string>> {
  const { feldbefuellung } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')
  const zeilen = await datenbank()
    .select()
    .from(feldbefuellung)
    .where(eq(feldbefuellung.quelle, quelle))
  return new Set(zeilen.filter((z) => z.befuellt === 0 && z.gesamt > 0).map((z) => z.feld))
}
