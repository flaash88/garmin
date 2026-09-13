import type { Zustand } from '@/lib/daten/planvorschlaege'

/** Was die Oberfläche von einem Plansatz sieht. */

export interface EinheitAnsicht {
  id: string
  tag: string
  name: string
  typ: string
  beschreibung: string | null
  dauerSekunden: number | null
  streckeMeter: number | null
  zielBelastung: number | null
  ersetztPlanId: string | null
  zustand: Zustand
  icuEventId: string | null
  fehler: string | null
  /**
   * Der Körper der Anfrage an intervals.icu, Wort für Wort. Kommt aus
   * derselben Funktion wie die Übertragung — nicht aus einer zweiten
   * Darstellung, die etwas anderes behaupten könnte.
   */
  nutzlast: string
}

export interface SatzAnsicht {
  id: string
  ziel: string | null
  vonTag: string
  bisTag: string
  wochen: number
  begruendung: string | null
  erstelltAm: string
  verworfenAm: string | null
  einheiten: EinheitAnsicht[]
}

/** Bestehende Einheiten, auf die sich ein «ersetzt …» bezieht. */
export type Bestehende = Record<string, { tag: string; name: string }>
