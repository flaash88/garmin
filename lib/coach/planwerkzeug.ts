import { z } from 'zod'
import {
  begruendungAblegen,
  einheitenAnhaengen,
  type NeueEinheit,
} from '@/lib/daten/planvorschlaege'
import { datum, zahl } from '@/lib/format'
import type { WerkzeugAntwort } from './werkzeuge'

/**
 * Das Werkzeug, mit dem der Coach einen Trainingsblock vorschlägt.
 *
 * Es schreibt **nur in Takt**, nie nach intervals.icu. Zwischen Vorschlag und
 * Kalender steht die Freigabe des Athleten, und die kommt aus der Oberfläche,
 * nicht von hier.
 *
 * Das Werkzeug steht nur im Planungsauftrag zur Verfügung. Im freien Gespräch
 * bekommt der Coach es nicht — sonst könnte eine beiläufige Frage einen
 * Plansatz erzeugen, den niemand bestellt hat.
 */

export const PLAN_WERKZEUG_NAME = 'plan_vorschlagen'

const EINHEIT = z.object({
  tag: z.string().describe('Tag der Einheit als JJJJ-MM-TT.'),
  name: z.string().describe('Kurzer Name, etwa "5 × 1000 m" oder "Langer Lauf".'),
  typ: z
    .string()
    .optional()
    .describe('Sportart für intervals.icu. Vorgabe: Run. Sonst etwa Ride, Swim, Workout.'),
  beschreibung: z
    .string()
    .optional()
    .describe('Der Ablauf im Klartext: Aufbau, Zielpace, Pausen. Geht mit nach intervals.icu.'),
  dauer_minuten: z.number().optional().describe('Zieldauer in Minuten.'),
  strecke_km: z.number().optional().describe('Zielstrecke in Kilometern.'),
  ziel_belastung: z.number().optional().describe('Ziel-Trainingsbelastung (icu_training_load).'),
  ersetzt_plan_id: z
    .string()
    .optional()
    .describe(
      'Kennung einer bestehenden Einheit aus dem Werkzeug "plan", die diese ' +
        'ersetzen soll. Nur setzen, wenn die alte wirklich weg soll — das ' +
        'verlangt vom Athleten eine eigene Bestätigung.',
    ),
})

export const PLAN_FORM = {
  einheiten: z
    .array(EINHEIT)
    .min(1)
    .describe('Die Einheiten dieses Aufrufs. Mehrere Aufrufe hängen aneinander an.'),
  begruendung: z
    .string()
    .optional()
    .describe('Warum der Block so aufgebaut ist. Einmal je Satz, nicht je Einheit.'),
}

export interface Planauftrag {
  vorschlagId: string
  vonTag: string
  bisTag: string
}

const TAG_FORM = /^\d{4}-\d{2}-\d{2}$/

/**
 * Eingaben prüfen, bevor sie in die Datenbank gehen.
 *
 * Der Coach ist keine vertrauenswürdige Aufruferin — auch hier nicht. Ein Tag
 * außerhalb des bestellten Blocks wird abgewiesen, nicht stillschweigend
 * zurechtgebogen: sonst stünde am Ende eine Einheit im Kalender, die niemand
 * bestellt hat.
 */
export function einheitPruefen(
  roh: z.infer<typeof EINHEIT>,
  auftrag: Planauftrag,
): { einheit: NeueEinheit } | { fehler: string } {
  const tag = roh.tag.trim()
  if (!TAG_FORM.test(tag)) {
    return { fehler: `«${roh.tag}» ist kein Tag in der Form JJJJ-MM-TT.` }
  }
  if (tag < auftrag.vonTag || tag > auftrag.bisTag) {
    return {
      fehler:
        `${datum(tag)} liegt außerhalb des Blocks ` +
        `(${datum(auftrag.vonTag)} bis ${datum(auftrag.bisTag)}).`,
    }
  }
  const name = roh.name.trim()
  if (name.length === 0) return { fehler: 'Die Einheit hat keinen Namen.' }

  const einheit: NeueEinheit = { tag, name, typ: (roh.typ ?? 'Run').trim() || 'Run' }
  if (roh.beschreibung !== undefined) einheit.beschreibung = roh.beschreibung
  if (roh.dauer_minuten !== undefined && Number.isFinite(roh.dauer_minuten)) {
    einheit.dauerSekunden = Math.round(roh.dauer_minuten * 60)
  }
  if (roh.strecke_km !== undefined && Number.isFinite(roh.strecke_km)) {
    einheit.streckeMeter = Math.round(roh.strecke_km * 1000)
  }
  if (roh.ziel_belastung !== undefined && Number.isFinite(roh.ziel_belastung)) {
    einheit.zielBelastung = Math.round(roh.ziel_belastung)
  }
  if (roh.ersetzt_plan_id !== undefined && roh.ersetzt_plan_id.trim().length > 0) {
    einheit.ersetztPlanId = roh.ersetzt_plan_id.trim()
  }
  return { einheit }
}

export async function werkzeugPlanVorschlagen(
  auftrag: Planauftrag,
  eingabe: { einheiten: Array<z.infer<typeof EINHEIT>>; begruendung?: string },
): Promise<WerkzeugAntwort> {
  const gute: NeueEinheit[] = []
  const abgewiesen: string[] = []

  for (const roh of eingabe.einheiten) {
    const geprueft = einheitPruefen(roh, auftrag)
    if ('fehler' in geprueft) abgewiesen.push(geprueft.fehler)
    else gute.push(geprueft.einheit)
  }

  const gesamt = await einheitenAnhaengen(auftrag.vorschlagId, gute)

  if (eingabe.begruendung && eingabe.begruendung.trim().length > 0) {
    await begruendungAblegen(auftrag.vorschlagId, eingabe.begruendung.trim())
  }

  const beschriftung =
    abgewiesen.length === 0
      ? `${zahl(gute.length)} Einheiten vorgeschlagen`
      : `${zahl(gute.length)} Einheiten vorgeschlagen, ${zahl(abgewiesen.length)} abgewiesen`

  const tage = gute.map((e) => e.tag).sort()
  const detail =
    gute.length === 0
      ? 'nichts übernommen'
      : `${datum(tage[0] ?? '')} bis ${datum(tage.at(-1) ?? '')} · ${zahl(gesamt)} im Satz`

  const inhalt = [
    `${gute.length} Einheiten übernommen. Der Satz enthält jetzt ${gesamt}.`,
    abgewiesen.length > 0
      ? `Abgewiesen:\n${abgewiesen.map((f) => `  - ${f}`).join('\n')}`
      : null,
    'Nichts davon steht in intervals.icu. Der Athlet gibt jede Einheit einzeln ' +
      'oder im Block frei; erst die Freigabe überträgt.',
  ]
    .filter((z): z is string => z !== null)
    .join('\n\n')

  return { beschriftung, detail, inhalt }
}
