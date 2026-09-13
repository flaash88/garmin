import { eq } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { verlaeufe } from '@/lib/db/schema'
import { verlaufHolen } from '@/lib/icu/endpunkte'
import { zugangAusUmgebung } from '@/lib/icu/klient'
import { istSatz, type Rohsatz } from '@/lib/icu/felder'
import type { Punkt } from '@/lib/analyse/strecken'

/**
 * Verläufe sind groß. Sie werden erst beim ersten Öffnen einer Aktivität
 * geholt und danach lokal gehalten.
 */
export async function verlaufBesorgen(
  aktivitaetId: string,
): Promise<{ daten: Rohsatz[]; fehler: string | null }> {
  const vorhanden = await datenbank()
    .select()
    .from(verlaeufe)
    .where(eq(verlaeufe.aktivitaetId, aktivitaetId))
    .limit(1)

  const zwischengespeichert = vorhanden[0]?.daten
  if (Array.isArray(zwischengespeichert)) {
    return { daten: zwischengespeichert as Rohsatz[], fehler: null }
  }

  try {
    const zugang = zugangAusUmgebung()
    const daten = await verlaufHolen(zugang, aktivitaetId)
    await datenbank()
      .insert(verlaeufe)
      .values({ aktivitaetId, daten })
      .onConflictDoUpdate({
        target: verlaeufe.aktivitaetId,
        set: { daten, geholtAm: new Date() },
      })
    return { daten, fehler: null }
  } catch (fehler) {
    // Ohne Verlauf bleibt die Seite brauchbar: Kopfzahlen und Runden stehen
    // in der Aktivität selbst. Nur die Karte fehlt dann.
    return {
      daten: [],
      fehler: fehler instanceof Error ? fehler.message : 'unbekannter Fehler',
    }
  }
}

function reihe(daten: readonly Rohsatz[], ...namen: string[]): unknown[] | null {
  for (const satz of daten) {
    const typ = satz['type']
    if (typeof typ === 'string' && namen.includes(typ)) {
      const werte = satz['data']
      if (Array.isArray(werte)) return werte
    }
  }
  return null
}

/**
 * Holt die Ortsdaten aus dem Verlauf. intervals.icu liefert sie je nach Stand
 * als Paare unter `latlng` oder getrennt als `lat` und `lng`.
 */
export function spurAusVerlauf(daten: readonly Rohsatz[]): Punkt[] {
  const paare = reihe(daten, 'latlng')
  if (paare) {
    return paare
      .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
      .filter(([b, l]) => Number.isFinite(b) && Number.isFinite(l))
      .map(([breite, laenge]) => ({ breite, laenge }))
  }

  const breiten = reihe(daten, 'lat', 'latitude')
  const laengen = reihe(daten, 'lng', 'lon', 'longitude')
  if (!breiten || !laengen) return []

  const spur: Punkt[] = []
  for (let i = 0; i < Math.min(breiten.length, laengen.length); i += 1) {
    const b = breiten[i]
    const l = laengen[i]
    if (typeof b === 'number' && typeof l === 'number' && Number.isFinite(b) && Number.isFinite(l)) {
      spur.push({ breite: b, laenge: l })
    }
  }
  return spur
}

export interface Runde {
  nummer: number
  sekunden: number | null
  meter: number | null
  pulsSchnitt: number | null
}

/** Runden stecken im Rohsatz der Aktivität, nicht im Verlauf. */
export function rundenAusRohdaten(rohdaten: unknown): Runde[] {
  if (!istSatz(rohdaten)) return []

  for (const name of ['icu_intervals', 'laps', 'intervals']) {
    const liste = rohdaten[name]
    if (!Array.isArray(liste)) continue

    return liste
      .filter(istSatz)
      .map((r, i) => ({
        nummer: i + 1,
        sekunden:
          typeof r['moving_time'] === 'number'
            ? r['moving_time']
            : typeof r['elapsed_time'] === 'number'
              ? r['elapsed_time']
              : null,
        meter: typeof r['distance'] === 'number' ? r['distance'] : null,
        pulsSchnitt:
          typeof r['average_heartrate'] === 'number'
            ? Math.round(r['average_heartrate'])
            : null,
      }))
  }
  return []
}
