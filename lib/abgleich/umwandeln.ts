/**
 * Wandelt Rohsätze von intervals.icu in die Form der Datenbank.
 *
 * Bewusst defensiv: jeder Satz wird zusätzlich vollständig als `rohdaten`
 * behalten. Stellt sich in Phase 4 heraus, dass ein Feld anders heißt, ist
 * die Angabe damit noch da und muss nicht neu geholt werden.
 */
import {
  ganzzahlOderNull,
  istSatz,
  kennungOderNull,
  tagOderNull,
  textOderNull,
  zahlOderNull,
  zeitpunktOderNull,
  type Rohsatz,
} from '@/lib/icu/felder'

export interface AktivitaetZeile {
  id: string
  beginn: Date
  name: string | null
  typ: string
  dauerSekunden: number | null
  streckeMeter: number | null
  hoehenmeter: number | null
  pulsSchnitt: number | null
  pulsMax: number | null
  belastung: number | null
  rohdaten: Rohsatz
}

export function aktivitaetUmwandeln(roh: unknown): AktivitaetZeile | null {
  if (!istSatz(roh)) return null
  const id = kennungOderNull(roh, 'id')
  const beginn = zeitpunktOderNull(roh, 'start_date_local', 'start_date')
  if (!id || !beginn) return null

  return {
    id,
    beginn,
    name: textOderNull(roh, 'name'),
    typ: textOderNull(roh, 'type') ?? 'Unbekannt',
    dauerSekunden: ganzzahlOderNull(roh, 'moving_time', 'elapsed_time'),
    streckeMeter: zahlOderNull(roh, 'distance'),
    hoehenmeter: zahlOderNull(roh, 'total_elevation_gain'),
    pulsSchnitt: ganzzahlOderNull(roh, 'average_heartrate'),
    pulsMax: ganzzahlOderNull(roh, 'max_heartrate'),
    belastung: ganzzahlOderNull(roh, 'icu_training_load'),
    rohdaten: roh,
  }
}

export interface WellnessZeile {
  tag: string
  ctl: number | null
  atl: number | null
  form: number | null
  ruhepuls: number | null
  hrv: number | null
  gewicht: number | null
  schlafSekunden: number | null
  befinden: number | null
  beschwerden: string | null
  verletzung: string | null
  notizen: string | null
  rohdaten: Rohsatz
}

/** Manche Stände liefern Sekunden, manche Stunden. */
function schlafSekunden(roh: Rohsatz): number | null {
  const sekunden = ganzzahlOderNull(roh, 'sleepSecs')
  if (sekunden !== null) return sekunden
  const stunden = zahlOderNull(roh, 'sleepHours')
  return stunden === null ? null : Math.round(stunden * 3600)
}

export function wellnessUmwandeln(roh: unknown): WellnessZeile | null {
  if (!istSatz(roh)) return null
  const tag = tagOderNull(roh, 'id', 'date', 'day')
  if (!tag) return null

  /*
   * CTL, ATL und Form kommen fertig. `form` heißt bei intervals.icu je nach
   * Stand `ctlLoad`-Differenz oder direkt `form`; gerechnet wird hier nichts.
   * Fällt `form` aus, bleibt es null — ein selbst gerechneter Wert wäre
   * nicht derselbe, und der Auftrag verlangt ausdrücklich den gelieferten.
   */
  return {
    tag,
    ctl: zahlOderNull(roh, 'ctl'),
    atl: zahlOderNull(roh, 'atl'),
    form: zahlOderNull(roh, 'form', 'ctlAtlBalance'),
    ruhepuls: ganzzahlOderNull(roh, 'restingHR', 'resting_hr'),
    hrv: zahlOderNull(roh, 'hrv'),
    gewicht: zahlOderNull(roh, 'weight'),
    schlafSekunden: schlafSekunden(roh),
    befinden: ganzzahlOderNull(roh, 'mood', 'feel'),
    beschwerden: textOderNull(roh, 'soreness', 'Soreness'),
    verletzung: textOderNull(roh, 'injury', 'Injury'),
    notizen: textOderNull(roh, 'comments', 'notes'),
    rohdaten: roh,
  }
}

export interface PlanZeile {
  id: string
  tag: string
  name: string | null
  typ: string | null
  beschreibung: string | null
  zielBelastung: number | null
  zielDauerSekunden: number | null
  zielStreckeMeter: number | null
  rohdaten: Rohsatz
}

export function planUmwandeln(roh: unknown): PlanZeile | null {
  if (!istSatz(roh)) return null
  const id = kennungOderNull(roh, 'id')
  const tag = tagOderNull(roh, 'start_date_local', 'start_date', 'date')
  if (!id || !tag) return null

  return {
    id,
    tag,
    name: textOderNull(roh, 'name'),
    typ: textOderNull(roh, 'type', 'category'),
    beschreibung: textOderNull(roh, 'description'),
    zielBelastung: ganzzahlOderNull(roh, 'icu_training_load', 'target_load'),
    zielDauerSekunden: ganzzahlOderNull(roh, 'moving_time', 'target_duration'),
    zielStreckeMeter: zahlOderNull(roh, 'distance', 'target_distance'),
    rohdaten: roh,
  }
}

export interface AusruestungZeile {
  id: string
  name: string
  art: string | null
  inBenutzung: number
  laufleistungMeter: number | null
  rohdaten: Rohsatz
}

export function ausruestungUmwandeln(roh: unknown): AusruestungZeile | null {
  if (!istSatz(roh)) return null
  const id = kennungOderNull(roh, 'id')
  const name = textOderNull(roh, 'name')
  if (!id || !name) return null

  const stillgelegt = roh['retired']
  return {
    id,
    name,
    art: textOderNull(roh, 'type'),
    inBenutzung: stillgelegt === true ? 0 : 1,
    laufleistungMeter: zahlOderNull(roh, 'distance', 'total_distance'),
    rohdaten: roh,
  }
}

export interface ZonenZeile {
  sportart: string
  gruppe: string[]
  schwellenPuls: number | null
  maxPuls: number | null
  schwellenPaceSekundenJeKm: number | null
  schwellenPaceMeterJeSekunde: number | null
  pulsGrenzen: number[] | null
  pulsZonenNamen: string[] | null
  paceGrenzen: number[] | null
  rohdaten: Rohsatz
}

/**
 * Kleinste und größte Geschwindigkeit, die als Laufen oder Radfahren
 * durchgeht — in Metern je Sekunde.
 *
 * 0,5 m/s sind 33:20/km, 15 m/s sind 1:07/km. Was dazwischen liegt, ist eine
 * Geschwindigkeit; was darüber liegt, kann nur eine Zeitangabe sein. Ohne
 * diese Unterscheidung würde eine Schwellenpace von 4,0 m/s als «0:04/km»
 * angezeigt.
 */
const GESCHWINDIGKEIT_MIN = 0.5
const GESCHWINDIGKEIT_MAX = 15

/**
 * `threshold_pace` in Sekunden je Kilometer.
 *
 * intervals.icu liefert eine **Geschwindigkeit** in Metern je Sekunde. Der
 * gelieferte Wert wird zusätzlich unverändert abgelegt, damit die Umrechnung
 * nachprüfbar bleibt und nicht die einzige Fassung ist.
 */
export function paceAusGeschwindigkeit(wert: number | null): number | null {
  if (wert === null || !Number.isFinite(wert) || wert <= 0) return null
  if (wert < GESCHWINDIGKEIT_MIN || wert > GESCHWINDIGKEIT_MAX) {
    // Keine plausible Geschwindigkeit. Dann ist es vermutlich schon eine
    // Zeitangabe — unverändert übernehmen statt eine Zahl zu erfinden.
    return wert
  }
  return 1000 / wert
}

/**
 * Listen werden **ganz oder gar nicht** übernommen.
 *
 * Einzelne unbrauchbare Einträge herauszufiltern würde die übrigen nach vorn
 * rutschen lassen — die dritte Zonengrenze stünde dann an zweiter Stelle und
 * der Zonenname an der falschen. Eine verschobene Liste ist schlechter als
 * keine: sie sieht richtig aus.
 */
function zahlenliste(wert: unknown): number[] | null {
  if (!Array.isArray(wert) || wert.length === 0) return null
  const brauchbar = wert.every((z) => typeof z === 'number' && Number.isFinite(z))
  return brauchbar ? (wert as number[]) : null
}

function textliste(wert: unknown): string[] | null {
  if (!Array.isArray(wert) || wert.length === 0) return null
  const brauchbar = wert.every((z) => typeof z === 'string' && z.length > 0)
  return brauchbar ? (wert as string[]) : null
}

/**
 * Ein Satz aus `/athlete/{id}/sport-settings` wird zu **einer Zeile je
 * Sportart**.
 *
 * Der Befund, der dahintersteckt: gelesen wurde `type` als Zeichenkette.
 * intervals.icu führt die Sportarten aber als Array unter `types`. Damit war
 * die Sportart immer `null`, jeder Satz fiel durch, und der Schritt meldete
 * «Zonen 0» — ohne Fehler. Siehe DECISIONS.md, E12.1.
 */
export function zonenUmwandeln(roh: unknown): ZonenZeile[] {
  if (!istSatz(roh)) return []

  const gruppe =
    textliste(roh['types']) ??
    // Ältere Stände und Einzelsätze führen eine einzelne Zeichenkette.
    (typeof roh['type'] === 'string' && roh['type'].length > 0 ? [roh['type']] : null)
  if (!gruppe) return []

  const geschwindigkeit = zahlOderNull(roh, 'threshold_pace')

  const gemeinsam = {
    gruppe,
    schwellenPuls: ganzzahlOderNull(roh, 'lthr'),
    maxPuls: ganzzahlOderNull(roh, 'max_hr'),
    schwellenPaceSekundenJeKm: paceAusGeschwindigkeit(geschwindigkeit),
    schwellenPaceMeterJeSekunde: geschwindigkeit,
    pulsGrenzen: zahlenliste(roh['hr_zones']),
    pulsZonenNamen: textliste(roh['hr_zone_names']),
    paceGrenzen: zahlenliste(roh['pace_zones']),
    rohdaten: roh,
  }

  return gruppe.map((sportart) => ({ sportart, ...gemeinsam }))
}
