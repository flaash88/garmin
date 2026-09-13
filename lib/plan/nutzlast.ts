/**
 * Was genau nach intervals.icu geschrieben wird.
 *
 * Diese Datei hat eine einzige Aufgabe: aus einer vorgeschlagenen Einheit den
 * Körper der POST-Anfrage bauen. Sowohl die Vorschau in der Oberfläche als
 * auch die Übertragung rufen **dieselbe** Funktion auf. Zwei getrennte Wege
 * wären eine Vorschau, die etwas anderes zeigt, als am Ende ankommt — und
 * damit keine Vorschau, sondern eine Behauptung.
 */

export interface Vorschlagseinheit {
  tag: string
  name: string
  typ: string
  beschreibung: string | null
  dauerSekunden: number | null
  streckeMeter: number | null
  zielBelastung: number | null
}

/**
 * Der Körper der POST-Anfrage an `/athlete/{id}/events`.
 *
 * Felder ohne Wert bleiben **weg** statt auf `null` zu stehen: intervals.icu
 * legt sonst eine Einheit mit einer Zieldauer von 0 an.
 */
export interface IcuNutzlast {
  category: 'WORKOUT'
  start_date_local: string
  type: string
  name: string
  description?: string
  moving_time?: number
  distance?: number
  icu_training_load?: number
}

export function icuNutzlast(einheit: Vorschlagseinheit): IcuNutzlast {
  const nutzlast: IcuNutzlast = {
    category: 'WORKOUT',
    // intervals.icu erwartet eine lokale Zeitangabe. Geplante Einheiten haben
    // keine Uhrzeit; Mitternacht ist die Festlegung, die der Kalender dort
    // auch selbst trifft.
    start_date_local: `${einheit.tag}T00:00:00`,
    type: einheit.typ,
    name: einheit.name,
  }
  if (einheit.beschreibung && einheit.beschreibung.trim().length > 0) {
    nutzlast.description = einheit.beschreibung
  }
  if (einheit.dauerSekunden !== null && einheit.dauerSekunden > 0) {
    nutzlast.moving_time = Math.round(einheit.dauerSekunden)
  }
  if (einheit.streckeMeter !== null && einheit.streckeMeter > 0) {
    nutzlast.distance = Math.round(einheit.streckeMeter)
  }
  if (einheit.zielBelastung !== null && einheit.zielBelastung > 0) {
    nutzlast.icu_training_load = Math.round(einheit.zielBelastung)
  }
  return nutzlast
}

/** Genau der Text, der übertragen wird — als JSON, wie er über die Leitung geht. */
export function nutzlastText(einheit: Vorschlagseinheit): string {
  return JSON.stringify(icuNutzlast(einheit), null, 2)
}
