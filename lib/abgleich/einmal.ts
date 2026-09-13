/**
 * Hält einen laufenden Vorgang fest, damit er nicht doppelt startet.
 *
 * Der Knopf in der Oberfläche sperrt sich selbst, solange ein Lauf offen ist.
 * Das genügt aber nicht: zwei Reiter nebeneinander wissen nichts voneinander,
 * und ein Neuladen mitten im Lauf setzt den Knopf zurück. Deshalb liegt die
 * Sperre zusätzlich im Serverprozess.
 *
 * Der zweite Aufruf bekommt **dasselbe Versprechen** zurück, nicht eine
 * Absage — wer klickt, will ein Ergebnis sehen, und das ist dann eben das
 * des laufenden Vorgangs.
 */

const global_ = globalThis as unknown as {
  taktLaufendeVorgaenge?: Map<string, Promise<unknown>>
}

function vorgaenge(): Map<string, Promise<unknown>> {
  global_.taktLaufendeVorgaenge ??= new Map()
  return global_.taktLaufendeVorgaenge
}

export interface EinmalErgebnis<T> {
  wert: T
  /** `true`, wenn dieser Aufruf den Vorgang gestartet hat. */
  gestartet: boolean
}

export async function einmalZugleich<T>(
  schluessel: string,
  lauf: () => Promise<T>,
): Promise<EinmalErgebnis<T>> {
  const offen = vorgaenge().get(schluessel) as Promise<T> | undefined
  if (offen) {
    return { wert: await offen, gestartet: false }
  }

  const versprechen = lauf()
  vorgaenge().set(schluessel, versprechen)
  try {
    return { wert: await versprechen, gestartet: true }
  } finally {
    if (vorgaenge().get(schluessel) === versprechen) vorgaenge().delete(schluessel)
  }
}

/** Nur für Tests. */
export function vorgaengeVergessen(): void {
  vorgaenge().clear()
}
