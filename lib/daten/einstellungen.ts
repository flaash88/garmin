import { eq, inArray } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { einstellungen } from '@/lib/db/schema'

/**
 * Einstellungen, die dauerhaft gelten. Liegen in der Datenbank, nicht im
 * Browser — sie überleben damit einen Neubau des Behälters.
 */

export const ZIEL_TEXT = 'ziel.text'
export const ZIEL_DATUM = 'ziel.datum'
export const ZIEL_ZEIT = 'ziel.zeit'

export interface Ziel {
  /** Freier Text: «Halbmarathon, flach, zweite Hälfte schneller». */
  text: string | null
  /** `YYYY-MM-DD`. */
  datum: string | null
  /** Wie eingetippt: «1:35:00» oder «sub 40». */
  zeit: string | null
}

export async function einstellungLesen(schluessel: string): Promise<string | null> {
  const zeilen = await datenbank()
    .select()
    .from(einstellungen)
    .where(eq(einstellungen.schluessel, schluessel))
    .limit(1)
  return zeilen[0]?.wert ?? null
}

export async function einstellungSchreiben(
  schluessel: string,
  wert: string | null,
): Promise<void> {
  if (wert === null || wert.trim().length === 0) {
    await datenbank().delete(einstellungen).where(eq(einstellungen.schluessel, schluessel))
    return
  }
  await datenbank()
    .insert(einstellungen)
    .values({ schluessel, wert: wert.trim() })
    .onConflictDoUpdate({
      target: einstellungen.schluessel,
      set: { wert: wert.trim(), geaendertAm: new Date() },
    })
}

export async function zielLesen(): Promise<Ziel> {
  const zeilen = await datenbank()
    .select()
    .from(einstellungen)
    .where(inArray(einstellungen.schluessel, [ZIEL_TEXT, ZIEL_DATUM, ZIEL_ZEIT]))

  const nach = new Map(zeilen.map((z) => [z.schluessel, z.wert]))
  return {
    text: nach.get(ZIEL_TEXT) ?? null,
    datum: nach.get(ZIEL_DATUM) ?? null,
    zeit: nach.get(ZIEL_ZEIT) ?? null,
  }
}

export async function zielSchreiben(ziel: Ziel): Promise<void> {
  await einstellungSchreiben(ZIEL_TEXT, ziel.text)
  await einstellungSchreiben(ZIEL_DATUM, ziel.datum)
  await einstellungSchreiben(ZIEL_ZEIT, ziel.zeit)
}

/**
 * Das Ziel als Satz für den Systemabschnitt des Coach. `null`, wenn nichts
 * hinterlegt ist — dann steht dort gar nichts statt einer leeren Überschrift.
 */
export function zielSatz(ziel: Ziel, heute = new Date()): string | null {
  const teile: string[] = []
  if (ziel.text) teile.push(ziel.text)
  if (ziel.zeit) teile.push(`Zielzeit ${ziel.zeit}`)

  if (ziel.datum) {
    const tag = new Date(`${ziel.datum}T00:00:00`)
    if (!Number.isNaN(tag.getTime())) {
      const zz = (n: number) => String(n).padStart(2, '0')
      const datumText = `${zz(tag.getDate())}.${zz(tag.getMonth() + 1)}.${tag.getFullYear()}`
      const tageHin = Math.round(
        (tag.getTime() - new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()).getTime()) /
          86_400_000,
      )
      teile.push(
        tageHin >= 0
          ? `am ${datumText}, noch ${tageHin} Tage`
          : `am ${datumText}, ${Math.abs(tageHin)} Tage her`,
      )
    }
  }

  return teile.length > 0 ? teile.join(' · ') : null
}
