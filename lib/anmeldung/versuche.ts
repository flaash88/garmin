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

/**
 * Zusätzlich zum Zähler je IP ein Zähler über alles. Der Auftrag nennt nur
 * den Zähler je IP; der allein trägt aber nicht, weil die Herkunft aus einem
 * Kopf stammt, den der Aufrufer setzen kann. Wer bei jeder Anfrage eine
 * andere IP behauptet, landet in lauter frischen Töpfen und wird nie
 * verzögert. Der Zähler über alles lässt sich so nicht umgehen.
 *
 * Preis: Wer auf den Dienst einhämmert, verzögert auch den Eigentümer. Bei
 * einer Obergrenze von 30 s ist das eine Verzögerung, keine Aussperrung — und
 * Takt hat genau einen Nutzer, für den ein Topf über alles ohnehin fast
 * dasselbe ist. Abweichung vom Auftrag, siehe DECISIONS.md E2.7.
 */
const ueberAlles: Stand = { fehlversuche: 0, zuletzt: 0 }

function aufraeumen(jetzt: number): void {
  for (const [ip, stand] of staende) {
    if (jetzt - stand.zuletzt > VERFALL_MS) staende.delete(ip)
  }
}

/**
 * Wie lange dieser Versuch warten muss, bevor das Passwort überhaupt geprüft
 * wird. Null, solange noch nichts danebenging.
 */
function verzugAus(stand: Stand | undefined, jetzt: number): number {
  if (!stand || stand.fehlversuche === 0) return 0
  if (jetzt - stand.zuletzt > VERFALL_MS) return 0
  if (stand.fehlversuche < AB_VERSUCH - 1) return 0
  const stufe = stand.fehlversuche - (AB_VERSUCH - 1)
  return Math.min(GRUNDVERZUG_MS * 2 ** stufe, HOECHSTVERZUG_MS)
}

export function verzug(ip: string, jetzt = Date.now()): number {
  return Math.max(verzugAus(staende.get(ip), jetzt), verzugAus(ueberAlles, jetzt))
}

export function fehlversuchNotieren(ip: string, jetzt = Date.now()): void {
  aufraeumen(jetzt)

  if (jetzt - ueberAlles.zuletzt > VERFALL_MS) ueberAlles.fehlversuche = 0
  ueberAlles.fehlversuche += 1
  ueberAlles.zuletzt = jetzt

  const stand = staende.get(ip)
  if (!stand || jetzt - stand.zuletzt > VERFALL_MS) {
    staende.set(ip, { fehlversuche: 1, zuletzt: jetzt })
    return
  }
  stand.fehlversuche += 1
  stand.zuletzt = jetzt
}

/** Nach erfolgreicher Anmeldung. Setzt beide Zähler zurück. */
export function zuruecksetzen(ip: string): void {
  staende.delete(ip)
  ueberAlles.fehlversuche = 0
  ueberAlles.zuletzt = 0
}

/** Nur für Tests. */
export function alleZuruecksetzen(): void {
  staende.clear()
  ueberAlles.fehlversuche = 0
  ueberAlles.zuletzt = 0
}

export function warten(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((fertig) => setTimeout(fertig, ms))
}
