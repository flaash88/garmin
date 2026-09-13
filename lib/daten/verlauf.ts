import { eq } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { verlaeufe } from '@/lib/db/schema'
import { verlaufHolen } from '@/lib/icu/endpunkte'
import { zugangAusUmgebung } from '@/lib/icu/klient'
import { istSatz, type Rohsatz } from '@/lib/icu/felder'
import type { Punkt } from '@/lib/analyse/strecken'

/**
 * Fassung des Abrufs.
 *
 * 1 — ohne `types`; intervals.icu lieferte die Vorauswahl, und darin fehlten
 *     die Ortsdaten. Solche Verläufe werden einmal erneuert.
 * 2 — mit ausdrücklich angeforderten Reihen, `latlng` voran.
 */
export const VERLAUF_FASSUNG = 2

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

  const zeile = vorhanden[0]
  const zwischengespeichert = zeile?.daten
  const aktuell = (zeile?.fassung ?? 0) >= VERLAUF_FASSUNG

  if (aktuell && Array.isArray(zwischengespeichert)) {
    return { daten: zwischengespeichert as Rohsatz[], fehler: null }
  }

  try {
    const zugang = zugangAusUmgebung()
    const daten = await verlaufHolen(zugang, aktivitaetId)
    await datenbank()
      .insert(verlaeufe)
      .values({ aktivitaetId, daten, fassung: VERLAUF_FASSUNG })
      .onConflictDoUpdate({
        target: verlaeufe.aktivitaetId,
        set: { daten, fassung: VERLAUF_FASSUNG, geholtAm: new Date() },
      })
    return { daten, fehler: null }
  } catch (fehler) {
    /*
     * Ohne Verlauf bleibt die Seite brauchbar: Kopfzahlen und Runden stehen
     * in der Aktivität selbst. Nur die Karte fehlt dann.
     *
     * Liegt ein alter Zwischenspeicher vor und scheitert nur die Erneuerung,
     * wird der alte gezeigt — lieber eine Karte von gestern als gar keine.
     */
    const text = fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
    if (Array.isArray(zwischengespeichert)) {
      return { daten: zwischengespeichert as Rohsatz[], fehler: text }
    }
    return { daten: [], fehler: text }
  }
}

/**
 * Name einer Reihe. intervals.icu führt ihn je nach Stand unter `type` oder
 * unter `name`.
 */
function reihenname(satz: Rohsatz): string | null {
  for (const schluessel of ['type', 'name', 'key']) {
    const wert = satz[schluessel]
    if (typeof wert === 'string' && wert.length > 0) return wert
  }
  return null
}

/** Werte einer Reihe. Ebenso: `data` oder `values`. */
function reihenwerte(satz: Rohsatz): unknown[] | null {
  for (const schluessel of ['data', 'values', 'stream']) {
    const wert = satz[schluessel]
    if (Array.isArray(wert)) return wert
  }
  return null
}

function reihe(daten: readonly Rohsatz[], ...namen: string[]): unknown[] | null {
  const gesucht = namen.map((n) => n.toLowerCase())
  for (const satz of daten) {
    const name = reihenname(satz)
    if (name && gesucht.includes(name.toLowerCase())) {
      const werte = reihenwerte(satz)
      if (werte) return werte
    }
  }
  return null
}

export interface Verlaufsdiagnose {
  /** Namen der Reihen, wie sie ankamen. */
  reihen: string[]
  /** Reihen, deren Namen sich nicht lesen liess — dann stimmt die Form nicht. */
  ohneNamen: number
  /** Schlüssel des ersten Satzes, zum Nachsehen, wenn nichts passt. */
  schluesselDesErsten: string[]
}

/**
 * Was tatsächlich ankam. Wird gezeigt, wenn keine Ortspunkte gefunden wurden —
 * damit ein leerer Kartenbereich sagt, woran es liegt, statt nur leer zu sein.
 */
export function verlaufsdiagnose(daten: readonly Rohsatz[]): Verlaufsdiagnose {
  const reihen: string[] = []
  let ohneNamen = 0
  for (const satz of daten) {
    const name = reihenname(satz)
    if (name) reihen.push(name)
    else ohneNamen += 1
  }
  return {
    reihen,
    ohneNamen,
    schluesselDesErsten: daten[0] ? Object.keys(daten[0]) : [],
  }
}

/**
 * Holt die Ortsdaten aus dem Verlauf. intervals.icu liefert sie je nach Stand
 * als Paare unter `latlng` oder getrennt als `lat` und `lng`.
 */
export function spurAusVerlauf(daten: readonly Rohsatz[]): Punkt[] {
  const paare = reihe(daten, 'latlng', 'latLng', 'position', 'coordinates')
  if (paare) {
    const punkte: Punkt[] = []
    for (const eintrag of paare) {
      // Als Paar [Breite, Länge] …
      if (Array.isArray(eintrag) && eintrag.length >= 2) {
        const [b, l] = eintrag
        if (typeof b === 'number' && typeof l === 'number' &&
            Number.isFinite(b) && Number.isFinite(l)) {
          punkte.push({ breite: b, laenge: l })
        }
        continue
      }
      // … oder als Objekt {lat, lng}. Beides kommt vor.
      if (istSatz(eintrag)) {
        const b = eintrag['lat'] ?? eintrag['latitude']
        const l = eintrag['lng'] ?? eintrag['lon'] ?? eintrag['longitude']
        if (typeof b === 'number' && typeof l === 'number' &&
            Number.isFinite(b) && Number.isFinite(l)) {
          punkte.push({ breite: b, laenge: l })
        }
      }
    }
    if (punkte.length > 0) return punkte
  }

  const breiten = reihe(daten, 'lat', 'latitude', 'position_lat')
  const laengen = reihe(daten, 'lng', 'lon', 'long', 'longitude', 'position_long')
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

/**
 * Die Pulsreihe eines Verlaufs.
 *
 * Wie bei den Ortsdaten wird nicht auf einen Feldnamen gesetzt: heisst die
 * Reihe anders, käme sonst still nichts zurück — genau der Befund von E10.2.
 */
export function pulsreiheAusVerlauf(daten: readonly Rohsatz[]): unknown[] {
  return reihe(daten, 'heartrate', 'heart_rate', 'hr', 'bpm') ?? []
}
