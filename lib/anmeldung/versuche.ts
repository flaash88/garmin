/**
 * Fehlversuche je IP, im Speicher. Ab dem dritten Versuch wächst die
 * Verzögerung: 1 s, 2 s, 4 s, 8 s … bis zu einer Obergrenze.
 *
 * Der Zählerstand verlässt diese Datei nicht. Die Oberfläche zeigt
 * ausschließlich „Passwort falsch" — wer zählt, verrät, wie viel Luft noch
 * bleibt. Der Entwurf zeigt „zweiter von fünf Versuchen"; das ist bewusst
 * nicht übernommen.
 */

const AB_VERSUCH = 3
const GRUNDVERZUG_MS = 1000
const HOECHSTVERZUG_MS = 30_000
/** Nach dieser Ruhezeit ohne Fehlversuch fängt die Zählung von vorn an. */
const VERFALL_MS = 15 * 60 * 1000

interface Stand {
  fehlversuche: number
  zuletzt: number
}

const staende = new Map<string, Stand>()

function aufraeumen(jetzt: number): void {
  for (const [ip, stand] of staende) {
    if (jetzt - stand.zuletzt > VERFALL_MS) staende.delete(ip)
  }
}

/**
 * Wie lange dieser Versuch warten muss, bevor das Passwort überhaupt geprüft
 * wird. Null, solange noch nichts danebenging.
 */
export function verzug(ip: string, jetzt = Date.now()): number {
  const stand = staende.get(ip)
  if (!stand) return 0
  if (jetzt - stand.zuletzt > VERFALL_MS) return 0
  if (stand.fehlversuche < AB_VERSUCH - 1) return 0
  const stufe = stand.fehlversuche - (AB_VERSUCH - 1)
  return Math.min(GRUNDVERZUG_MS * 2 ** stufe, HOECHSTVERZUG_MS)
}

export function fehlversuchNotieren(ip: string, jetzt = Date.now()): void {
  aufraeumen(jetzt)
  const stand = staende.get(ip)
  if (!stand || jetzt - stand.zuletzt > VERFALL_MS) {
    staende.set(ip, { fehlversuche: 1, zuletzt: jetzt })
    return
  }
  stand.fehlversuche += 1
  stand.zuletzt = jetzt
}

export function zuruecksetzen(ip: string): void {
  staende.delete(ip)
}

/** Nur für Tests. */
export function alleZuruecksetzen(): void {
  staende.clear()
}

export function warten(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((fertig) => setTimeout(fertig, ms))
}
