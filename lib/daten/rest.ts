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
 * Befüllung je Feldname, wie sie der letzte Abgleich festgehalten hat.
 *
 * Gibt die **rohen Stände** zurück, keine fertige Ja/Nein-Liste. Der Grund:
 * eine Spalte der Oberfläche kann aus mehreren möglichen Feldnamen gespeist
 * werden (`sleepSecs` oder `sleepHours`), und `befuellungZaehlen` kennt nur
 * die Namen, die intervals.icu tatsächlich geschickt hat. Wer nur fragt
 * „sind alle Namen leer?", bekäme für nie geschickte Namen ein Nein und
 * blendete nie etwas aus. Die Entscheidung trifft `spalteZeigen`.
 */
export async function befuellung(
  quelle: string,
): Promise<Map<string, { befuellt: number; gesamt: number }>> {
  const { feldbefuellung } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')
  const zeilen = await datenbank()
    .select()
    .from(feldbefuellung)
    .where(eq(feldbefuellung.quelle, quelle))
  return new Map(zeilen.map((z) => [z.feld, { befuellt: z.befuellt, gesamt: z.gesamt }]))
}

/**
 * Ob eine Spalte gezeigt wird. Sie verschwindet nur, wenn von ihren
 * möglichen Feldnamen **mindestens einer** überhaupt vorkam und **alle**
 * vorgekommenen durchgehend leer blieben. Namen, die nie geschickt wurden,
 * sagen nichts aus und werden übergangen.
 *
 * Ist noch gar nichts festgehalten — vor der ersten Erstbefüllung —, wird
 * alles gezeigt. Siehe DECISIONS.md, E0.8 und E4.11.
 */
export function spalteZeigen(
  stand: Map<string, { befuellt: number; gesamt: number }>,
  feldnamen: readonly string[],
): boolean {
  if (stand.size === 0) return true

  const bekannt = feldnamen
    .map((f) => stand.get(f))
    .filter((s): s is { befuellt: number; gesamt: number } => s !== undefined && s.gesamt > 0)

  if (bekannt.length === 0) return true
  return !bekannt.every((s) => s.befuellt === 0)
}
