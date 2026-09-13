import Anthropic from '@anthropic-ai/sdk'
import { and, desc, eq } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { analysen } from '@/lib/db/schema'
import { athletenprofil } from './profil'
import {
  werkzeugAktivitaeten,
  werkzeugAusruestung,
  werkzeugBelastung,
  werkzeugErholung,
  werkzeugPlan,
  werkzeugSql,
  type WerkzeugAntwort,
} from './werkzeuge'
import { kalenderwoche } from '@/lib/daten/zeit'

/**
 * Die festen Analysen — Wochenbriefing, Bewertung einer Einheit,
 * Plananpassung.
 *
 * Bewusst **nicht** über das Agent SDK, sondern über die Messages-API mit fest
 * umrissenen Werkzeugen. Zwei Gründe: die Aufgabe ist jedes Mal dieselbe, und
 * das Ergebnis wird abgelegt statt gestreamt. Ein Agent, der frei entscheidet,
 * wäre hier teurer und weniger vorhersagbar.
 */

export const MODELL = 'claude-opus-5'

export type Analyseart = 'wochenbriefing' | 'einheit' | 'plananpassung'

const WERKZEUGE: Anthropic.Tool[] = [
  {
    name: 'aktivitaeten',
    description: 'Läufe im Zeitraum mit Strecke, Dauer, Puls und Belastung.',
    input_schema: {
      type: 'object',
      properties: { zeitraum: { type: 'string' } },
      required: ['zeitraum'],
      additionalProperties: false,
    },
  },
  {
    name: 'belastung',
    description: 'Wochenbelastung, Monotonie nach Foster, Belastungsdruck, Rampe.',
    input_schema: {
      type: 'object',
      properties: { zeitraum: { type: 'string' } },
      required: ['zeitraum'],
      additionalProperties: false,
    },
  },
  {
    name: 'erholung',
    description: 'Schlaf, HRV, Ruhepuls, Befinden, Beschwerden und Notizen je Tag.',
    input_schema: {
      type: 'object',
      properties: { zeitraum: { type: 'string' } },
      required: ['zeitraum'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan',
    description: 'Geplante Einheiten einer Kalenderwoche.',
    input_schema: {
      type: 'object',
      properties: { kw: { type: 'number' } },
      additionalProperties: false,
    },
  },
  {
    name: 'ausruestung',
    description: 'Schuhe und ihre Laufleistung.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'sql_abfrage',
    description: 'Eine einzige SELECT-Anweisung gegen das Auswertungsschema.',
    input_schema: {
      type: 'object',
      properties: { sql: { type: 'string' } },
      required: ['sql'],
      additionalProperties: false,
    },
  },
]

/** Dieselbe Wache wie im freien Chat — die Werkzeuge sind buchstäblich dieselben. */
async function werkzeugAusfuehren(
  name: string,
  eingabe: Record<string, unknown>,
): Promise<WerkzeugAntwort> {
  const zeitraum = typeof eingabe['zeitraum'] === 'string' ? eingabe['zeitraum'] : ''
  switch (name) {
    case 'aktivitaeten':
      return werkzeugAktivitaeten(zeitraum)
    case 'belastung':
      return werkzeugBelastung(zeitraum)
    case 'erholung':
      return werkzeugErholung(zeitraum)
    case 'plan':
      return werkzeugPlan(
        typeof eingabe['kw'] === 'number' ? eingabe['kw'] : undefined,
      )
    case 'ausruestung':
      return werkzeugAusruestung()
    case 'sql_abfrage':
      return werkzeugSql(typeof eingabe['sql'] === 'string' ? eingabe['sql'] : '')
    default:
      return {
        beschriftung: `Werkzeug ${name} abgewiesen`,
        detail: 'Unbekanntes Werkzeug.',
        inhalt: JSON.stringify({ fehler: `Werkzeug ${name} gibt es nicht.` }),
      }
  }
}

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
ohne Not.`,

  einheit: (id) =>
    `Bewerte die Aktivität mit der Kennung ${id}.

Vergleich sie mit den Läufen der letzten acht Wochen. Geh auf Pace, Puls und
Belastung ein und sag, ob sie zum geplanten Zweck passte. Höchstens 150
Wörter.`,

  plananpassung: (kw) =>
    `Prüf den Plan für Kalenderwoche ${kw} gegen Form, Ermüdung und Rampe.

Sag, ob er so bleiben kann. Wenn nicht, nenn genau die Einheiten, die du
ändern würdest, und wie. Ändere nichts selbst — du schlägst vor, der Athlet
entscheidet. Höchstens 200 Wörter.`,
}

export interface AnalyseErgebnis {
  text: string
  werkzeugaufrufe: Array<{ beschriftung: string; detail: string }>
}

export async function analyseErzeugen(
  art: Analyseart,
  bezug: string,
): Promise<AnalyseErgebnis> {
  const schluessel = process.env['ANTHROPIC_API_KEY']
  if (!schluessel) {
    throw new Error('ANTHROPIC_API_KEY fehlt.')
  }

  const klient = new Anthropic()
  const profil = await athletenprofil()

  const nachrichten: Anthropic.MessageParam[] = [
    { role: 'user', content: AUFTRAEGE[art](bezug) },
  ]
  const aufrufe: Array<{ beschriftung: string; detail: string }> = []

  // Höchstens acht Züge; danach soll geantwortet werden, nicht weiter geholt.
  for (let zug = 0; zug < 8; zug += 1) {
    const antwort = await klient.messages.create({
      model: MODELL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: [
        // Das Profil ändert sich selten und steht vorn: nur so greift die
        // Zwischenspeicherung der API.
        { type: 'text', text: profil, cache_control: { type: 'ephemeral' } },
      ],
      tools: WERKZEUGE,
      messages: nachrichten,
    })

    if (antwort.stop_reason === 'refusal') {
      throw new Error('Der Coach hat die Anfrage abgelehnt.')
    }

    const werkzeugbloecke = antwort.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    if (werkzeugbloecke.length === 0) {
      const text = antwort.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      return { text, werkzeugaufrufe: aufrufe }
    }

    nachrichten.push({ role: 'assistant', content: antwort.content })

    // Alle Werkzeugergebnisse in **einer** Nachricht zurück — getrennt
    // gesendet gewöhnt sich das Modell parallele Aufrufe ab.
    const ergebnisse: Anthropic.ToolResultBlockParam[] = []
    for (const block of werkzeugbloecke) {
      const eingabe =
        typeof block.input === 'object' && block.input !== null
          ? (block.input as Record<string, unknown>)
          : {}
      const antwortDesWerkzeugs = await werkzeugAusfuehren(block.name, eingabe)
      aufrufe.push({
        beschriftung: antwortDesWerkzeugs.beschriftung,
        detail: antwortDesWerkzeugs.detail,
      })
      ergebnisse.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: antwortDesWerkzeugs.inhalt,
      })
    }
    nachrichten.push({ role: 'user', content: ergebnisse })
  }

  throw new Error('Der Coach kam nach acht Zügen zu keiner Antwort.')
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

/**
 * Einmal wöchentlich, nicht bei jedem Seitenaufruf. Gibt zurück, ob etwas
 * erzeugt wurde.
 */
export async function briefingBeiBedarf(heute = new Date()): Promise<boolean> {
  const { jahr, woche } = kalenderwoche(heute)
  const bezug = `${jahr}-KW${String(woche).padStart(2, '0')}`

  if (await analyseHolen('wochenbriefing', bezug)) return false

  const ergebnis = await analyseErzeugen('wochenbriefing', bezug)
  await analyseAblegen('wochenbriefing', bezug, ergebnis.text)
  return true
}
