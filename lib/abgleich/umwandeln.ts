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
  const id = textOderNull(roh, 'id')
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
  const id = textOderNull(roh, 'id')
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
  const id = textOderNull(roh, 'id')
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
