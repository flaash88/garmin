import { and, desc, eq } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { analysen } from '@/lib/db/schema'
import { coachFragen, MODELL } from './agent'
import { kalenderwoche } from '@/lib/daten/zeit'
import { ZugangAbgelaufen } from './zugang'

/**
 * Die festen Analysen — Wochenbriefing, Bewertung einer Einheit,
 * Plananpassung.
 *
 * Sie laufen über **denselben** Weg wie der freie Chat: das Agent SDK mit dem
 * Token aus dem Claude-Code-Abo. Ursprünglich war dafür die Messages-API mit
 * eigenen Werkzeugdefinitionen vorgesehen; die bräuchte einen zweiten Zugang,
 * und für eine Funktion einen zweiten Zugang zu verlangen ist keine gute
 * Vorgabe. Siehe DECISIONS.md, E7.2.
 *
 * Der Unterschied zum freien Chat liegt nicht im Weg, sondern im Auftrag: der
 * Text steht fest, und das Ergebnis wird abgelegt statt gestreamt.
 */

export { MODELL }

export type Analyseart = 'wochenbriefing' | 'einheit' | 'plananpassung'

const AUFTRAEGE: Record<Analyseart, (bezug: string) => string> = {
  wochenbriefing: (kw) =>
    `Schreib das Wochenbriefing für Kalenderwoche ${kw}.

Hol dir die Belastung und die Erholung der letzten acht Wochen und den Plan
der Woche. Geh auf drei Dinge ein, in dieser Reihenfolge:

1. Was diese Woche gelaufen ist, im Verhältnis zu den Wochen davor.
2. Monotonie, Belastungsdruck und Rampe — mit Zahl, und was sie bedeuten.
3. Beschwerden und Auffälligkeiten aus den Notizen, falls welche notiert
   wurden. Wurde nichts notiert, sag das ausdrücklich statt es wegzulassen.

Höchstens 250 Wörter. Kein Vorspann, keine Überschrift, keine Aufzählung
ohne Not. Gib nur das Briefing aus, keine Einleitung darüber, was du gleich
tun wirst.`,

  einheit: (id) =>
    `Bewerte die Aktivität mit der Kennung ${id}.

Vergleich sie mit den Läufen der letzten acht Wochen. Geh auf Pace, Puls und
Belastung ein und sag, ob sie zum geplanten Zweck passte. Höchstens 150
Wörter. Gib nur die Bewertung aus.`,

  plananpassung: (kw) =>
    `Prüf den Plan für Kalenderwoche ${kw} gegen Form, Ermüdung und Rampe.

Sag, ob er so bleiben kann. Wenn nicht, nenn genau die Einheiten, die du
ändern würdest, und wie. Ändere nichts selbst — du schlägst vor, der Athlet
entscheidet. Höchstens 200 Wörter. Gib nur den Vorschlag aus.`,
}

export interface AnalyseErgebnis {
  text: string
  werkzeugaufrufe: Array<{ beschriftung: string; detail: string }>
}

export async function analyseErzeugen(
  art: Analyseart,
  bezug: string,
): Promise<AnalyseErgebnis> {
  const stuecke: string[] = []
  const aufrufe: Array<{ beschriftung: string; detail: string }> = []
  let zugangsfehler = false

  for await (const e of coachFragen(AUFTRAEGE[art](bezug))) {
    if (e.art === 'text' && e.text) stuecke.push(e.text)
    else if (e.art === 'werkzeug') {
      aufrufe.push({
        beschriftung: e.beschriftung ?? '',
        detail: e.detail ?? '',
      })
    } else if (e.art === 'zugang') {
      zugangsfehler = true
    } else if (e.art === 'fehler') {
      throw new Error(e.text ?? 'Der Coach hat abgebrochen.')
    }
  }

  if (zugangsfehler) throw new ZugangAbgelaufen()

  const text = stuecke.join('').trim()
  if (text.length === 0) {
    throw new Error('Der Coach hat keine Antwort geliefert.')
  }
  return { text, werkzeugaufrufe: aufrufe }
}

export async function analyseAblegen(
  art: Analyseart,
  bezug: string,
  text: string,
): Promise<void> {
  await datenbank()
    .insert(analysen)
    .values({ id: `${art}:${bezug}`, art, bezug, text, modell: MODELL })
    .onConflictDoUpdate({
      target: analysen.id,
      set: { text, modell: MODELL, erstelltAm: new Date() },
    })
}

export async function analyseHolen(art: Analyseart, bezug: string) {
  const zeilen = await datenbank()
    .select()
    .from(analysen)
    .where(and(eq(analysen.art, art), eq(analysen.bezug, bezug)))
    .limit(1)
  return zeilen[0] ?? null
}

export async function juengstesBriefing() {
  const zeilen = await datenbank()
    .select()
    .from(analysen)
    .where(eq(analysen.art, 'wochenbriefing'))
    .orderBy(desc(analysen.erstelltAm))
    .limit(1)
  return zeilen[0] ?? null
}

export function briefingBezug(heute = new Date()): string {
  const { jahr, woche } = kalenderwoche(heute)
  return `${jahr}-KW${String(woche).padStart(2, '0')}`
}

/**
 * Einmal wöchentlich, nicht bei jedem Seitenaufruf. Gibt zurück, ob etwas
 * erzeugt wurde.
 *
 * Wirft weiter — wer aufruft, entscheidet, was ein Fehlschlag bedeutet. Der
 * Zeitplan protokolliert und versucht es beim nächsten Lauf erneut; ein
 * Aufruf von Hand soll den Fehler sehen.
 */
export async function briefingBeiBedarf(heute = new Date()): Promise<boolean> {
  const bezug = briefingBezug(heute)
  if (await analyseHolen('wochenbriefing', bezug)) return false

  const ergebnis = await analyseErzeugen('wochenbriefing', bezug)
  await analyseAblegen('wochenbriefing', bezug, ergebnis.text)
  return true
}
