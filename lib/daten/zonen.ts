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
 * Anzeigen: aus vier gelieferten Sätzen werden leicht zwölf Zeilen, die
 * dreimal dasselbe sagen. Angezeigt wird deshalb die Gruppe.
 */
export interface Zonengruppe {
  sportarten: string[]
  satz: Zonensatz
}

const ZUERST = ['Run', 'VirtualRun', 'TrailRun']

export function zuGruppen(saetze: readonly Zonensatz[]): Zonengruppe[] {
  const nach = new Map<string, Zonengruppe>()

  for (const satz of saetze) {
    const gruppe = grenzenText(satz)
    const vorhanden = nach.get(gruppe)
    if (vorhanden) vorhanden.sportarten.push(satz.sportart)
    else nach.set(gruppe, { sportarten: [satz.sportart], satz })
  }

  const gruppen = [...nach.values()]
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

/** Schlüssel, unter dem zwei Sätze als «dieselben Werte» gelten. */
function grenzenText(satz: Zonensatz): string {
  return JSON.stringify([
    satz.schwellenPuls,
    satz.maxPuls,
    satz.schwellenPaceSekundenJeKm,
    satz.pulsGrenzen,
  ])
}
