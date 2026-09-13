import { icuHolen, type IcuZugang } from './klient'
import type { Rohsatz } from './felder'

/**
 * Die Endpunkte, die Takt braucht. `cols` beziehungsweise `fields` werden
 * konsequent gesetzt — keine vollen Datensätze, wo wenige Spalten reichen.
 *
 * Ausnahme: Wellness wird **vollständig** gezogen. Das Wochenbriefing stützt
 * sich auf Beschwerden, Verletzung, Befinden und Notizen, und welche Felder
 * intervals.icu dort führt, steht erst nach dem ersten echten Aufruf fest.
 */

export const AKTIVITAET_SPALTEN = [
  'id',
  'start_date_local',
  'name',
  'type',
  'moving_time',
  'elapsed_time',
  'distance',
  'total_elevation_gain',
  'average_heartrate',
  'max_heartrate',
  'icu_training_load',
  'icu_intensity',
  'pace',
  'gear',
] as const

export async function aktivitaetenHolen(
  zugang: IcuZugang,
  vonTag: string,
  bisTag: string,
): Promise<Rohsatz[]> {
  const antwort = await icuHolen<unknown>(
    zugang,
    `/athlete/${zugang.athletId}/activities`,
    { suchwerte: { oldest: vonTag, newest: bisTag }, cols: AKTIVITAET_SPALTEN },
  )
  return Array.isArray(antwort) ? (antwort as Rohsatz[]) : []
}

/** Verläufe sind groß und werden nur bei Bedarf geholt, danach lokal gehalten. */
export async function verlaufHolen(
  zugang: IcuZugang,
  aktivitaetId: string,
): Promise<Rohsatz[]> {
  const antwort = await icuHolen<unknown>(zugang, `/activity/${aktivitaetId}/streams`)
  return Array.isArray(antwort) ? (antwort as Rohsatz[]) : []
}

/**
 * Vollständig, ohne `cols`. CTL, ATL und Form kommen von hier und werden
 * nicht selbst gerechnet.
 */
export async function wellnessHolen(
  zugang: IcuZugang,
  vonTag: string,
  bisTag: string,
): Promise<Rohsatz[]> {
  const antwort = await icuHolen<unknown>(
    zugang,
    `/athlete/${zugang.athletId}/wellness`,
    { suchwerte: { oldest: vonTag, newest: bisTag } },
  )
  if (Array.isArray(antwort)) return antwort as Rohsatz[]
  // Manche Stände liefern ein Objekt, getastet nach Datum.
  if (antwort && typeof antwort === 'object') {
    return Object.values(antwort as Record<string, Rohsatz>)
  }
  return []
}

export async function planHolen(
  zugang: IcuZugang,
  vonTag: string,
  bisTag: string,
): Promise<Rohsatz[]> {
  const antwort = await icuHolen<unknown>(zugang, `/athlete/${zugang.athletId}/events`, {
    suchwerte: { oldest: vonTag, newest: bisTag },
  })
  return Array.isArray(antwort) ? (antwort as Rohsatz[]) : []
}

/** Der Plan wird auch geschrieben. */
export async function planEintragen(
  zugang: IcuZugang,
  eintrag: Rohsatz,
): Promise<Rohsatz> {
  return icuHolen<Rohsatz>(zugang, `/athlete/${zugang.athletId}/events`, {
    methode: 'POST',
    koerper: eintrag,
  })
}

export async function ausruestungHolen(zugang: IcuZugang): Promise<Rohsatz[]> {
  const antwort = await icuHolen<unknown>(zugang, `/athlete/${zugang.athletId}/gear`)
  return Array.isArray(antwort) ? (antwort as Rohsatz[]) : []
}

export async function zonenHolen(zugang: IcuZugang): Promise<Rohsatz[]> {
  const antwort = await icuHolen<unknown>(
    zugang,
    `/athlete/${zugang.athletId}/sport-settings`,
  )
  return Array.isArray(antwort) ? (antwort as Rohsatz[]) : []
}
