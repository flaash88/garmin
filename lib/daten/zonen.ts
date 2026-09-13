import { asc, eq } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { zonen } from '@/lib/db/schema'

/**
 * Zonen und Schwellen, nach Sportart.
 *
 * Eine Zeile je Sportart, nicht je Gruppe: wer einen Lauf auswertet, sucht
 * unter «Run» und muss nicht wissen, dass intervals.icu Lauf, Laufband und
 * Trail in einen Satz legt.
 */

export type Zonensatz = typeof zonen.$inferSelect

function grenzenAls(wert: unknown): number[] {
  if (!Array.isArray(wert)) return []
  return wert.filter((z): z is number => typeof z === 'number' && Number.isFinite(z))
}

/** Die Pulsgrenzen eines Satzes, aufsteigend. Leer, wenn keine hinterlegt sind. */
export function pulsgrenzen(satz: Zonensatz | null): number[] {
  return satz ? grenzenAls(satz.pulsGrenzen) : []
}

export async function zonenFuerSportart(sportart: string): Promise<Zonensatz | null> {
  const zeilen = await datenbank()
    .select()
    .from(zonen)
    .where(eq(zonen.sportart, sportart))
    .limit(1)
  return zeilen[0] ?? null
}

export async function alleZonensaetze(): Promise<Zonensatz[]> {
  return datenbank().select().from(zonen).orderBy(asc(zonen.sportart))
}

/**
 * Die Sätze zu Gruppen zusammengefasst, Laufen zuerst.
 *
 * Eine Zeile je Sportart ist richtig zum Nachschlagen und falsch zum
 * Anzeigen: aus vier gelieferten Sätzen werden zwölf Zeilen, die dreimal
 * dasselbe sagen. Angezeigt wird deshalb die Gruppe.
 *
 * Gruppiert wird nach der **gelieferten** Gruppe, nicht nach gleichen Werten.
 * Mit den echten Daten des Athleten tragen «Swim, OpenWaterSwim» und «Other»
 * dieselben Grenzen; nach Werten zusammengefasst wären sie zu einer Zeile
 * «OpenWaterSwim, Other, Swim» verschmolzen und hätten drei Sätze behauptet,
 * wo intervals.icu vier führt.
 */
export interface Zonengruppe {
  sportarten: string[]
  satz: Zonensatz
}

const ZUERST = ['Run', 'VirtualRun', 'TrailRun']

function gruppeAls(wert: unknown): string[] | null {
  if (!Array.isArray(wert)) return null
  const namen = wert.filter((z): z is string => typeof z === 'string' && z.length > 0)
  return namen.length > 0 ? namen : null
}

export function zuGruppen(saetze: readonly Zonensatz[]): Zonengruppe[] {
  const nach = new Map<string, Zonengruppe>()

  for (const satz of saetze) {
    const gruppe = gruppeAls(satz.gruppe)
    /*
     * Ohne hinterlegte Gruppe steht die Sportart für sich. Das trifft
     * Zeilen, die vor der Umstellung angelegt wurden — sie sollen sichtbar
     * bleiben, nicht wegfallen.
     */
    const schluessel = gruppe ? gruppe.join('\u0000') : `einzeln:${satz.sportart}`
    const vorhanden = nach.get(schluessel)
    if (vorhanden) vorhanden.sportarten.push(satz.sportart)
    else nach.set(schluessel, { sportarten: [satz.sportart], satz })
  }

  const gruppen = [...nach.values()]
  for (const g of gruppen) g.sportarten.sort()

  // Laufen zuerst: Takt ist eine Laufanalyse, und was oben steht, wird
  // gelesen.
  gruppen.sort((a, b) => {
    const al = a.sportarten.some((s) => ZUERST.includes(s)) ? 0 : 1
    const bl = b.sportarten.some((s) => ZUERST.includes(s)) ? 0 : 1
    if (al !== bl) return al - bl
    return (a.sportarten[0] ?? '').localeCompare(b.sportarten[0] ?? '')
  })
  return gruppen
}
