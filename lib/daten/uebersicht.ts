import { and, desc, gte, lt, lte, sql } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { aktivitaeten, plan, wellness } from '@/lib/db/schema'
import { rampe, type RampeErgebnis } from '@/lib/analyse/belastung'
import { montagDerWoche, tageSpaeter, tagText, tageZurueck } from './zeit'

export interface Formkachel {
  /** TSB. Kommt fertig von intervals.icu. */
  form: number | null
  formVorSiebenTagen: number | null
  /** CTL. */
  fitness: number | null
  /** ATL. */
  ermuedung: number | null
  ermuedungVorwoche: number | null
  /** Anstieg der Fitness, selbst gerechnet. */
  rampe: RampeErgebnis | null
}

async function wellnessAmOderVor(tag: string) {
  const zeilen = await datenbank()
    .select()
    .from(wellness)
    .where(lte(wellness.tag, tag))
    .orderBy(desc(wellness.tag))
    .limit(1)
  return zeilen[0] ?? null
}

export async function formkachel(heute = new Date()): Promise<Formkachel | null> {
  const jetzt = await wellnessAmOderVor(tagText(heute))
  if (!jetzt) return null

  const vorSieben = await wellnessAmOderVor(tagText(tageZurueck(7, heute)))
  const vorVier = await wellnessAmOderVor(tagText(tageZurueck(28, heute)))

  return {
    form: jetzt.form,
    formVorSiebenTagen: vorSieben?.form ?? null,
    fitness: jetzt.ctl,
    ermuedung: jetzt.atl,
    ermuedungVorwoche: vorSieben?.atl ?? null,
    rampe:
      jetzt.ctl !== null && vorVier?.ctl != null ? rampe(vorVier.ctl, jetzt.ctl) : null,
  }
}

export interface Wochenkachel {
  /** Tatsächlich gelaufene Strecke dieser Woche, in Metern. */
  gelaufenMeter: number
  /** Vorgabe aus dem Plan, in Metern. `null` heißt: kein Plan angelegt. */
  vorgabeMeter: number | null
  /** Anteil erreicht. `null`, solange es keine Vorgabe gibt. */
  anteil: number | null
  /** Ob für diese Woche überhaupt Einträge im Plan stehen. */
  planAngelegt: boolean
}

export async function wochenkachel(heute = new Date()): Promise<Wochenkachel> {
  const montag = montagDerWoche(heute)
  // Bis zum Beginn des Folgemontags. Ein `lte` auf Sonntag Mitternacht
  // liesse jeden Sonntagslauf unter den Tisch fallen — das Balkendiagramm
  // darunter zeigte ihn, die Kachel nicht.
  const naechsterMontag = tageSpaeter(7, montag)
  const sonntagEnde = tageSpaeter(6, montag)

  const [gelaufen] = await datenbank()
    .select({ summe: sql<string | null>`sum(${aktivitaeten.streckeMeter})` })
    .from(aktivitaeten)
    .where(and(gte(aktivitaeten.beginn, montag), lt(aktivitaeten.beginn, naechsterMontag)))

  const geplant = await datenbank()
    .select()
    .from(plan)
    .where(and(gte(plan.tag, tagText(montag)), lte(plan.tag, tagText(sonntagEnde))))

  const gelaufenMeter = Number(gelaufen?.summe ?? 0) || 0
  const planAngelegt = geplant.length > 0

  const vorgabeSumme = geplant.reduce((s, e) => s + (e.zielStreckeMeter ?? 0), 0)
  // Ein Plan ohne Streckenvorgabe ist etwas anderes als kein Plan. Beides
  // führt zu 'ohne Vorgabe', aber nur eines zu 'Plan nicht angelegt'.
  const vorgabeMeter = planAngelegt && vorgabeSumme > 0 ? vorgabeSumme : null

  return {
    gelaufenMeter,
    vorgabeMeter,
    anteil: vorgabeMeter === null ? null : gelaufenMeter / vorgabeMeter,
    planAngelegt,
  }
}

export interface NaechsteEinheit {
  tag: string
  name: string | null
  typ: string | null
  beschreibung: string | null
  /** Ganze Tage bis dahin. 0 heißt heute. */
  inTagen: number
}

export async function naechsteEinheit(heute = new Date()): Promise<NaechsteEinheit | null> {
  const heuteText = tagText(heute)
  const zeilen = await datenbank()
    .select()
    .from(plan)
    .where(gte(plan.tag, heuteText))
    .orderBy(plan.tag)
    .limit(1)

  const e = zeilen[0]
  if (!e) return null

  const dann = new Date(`${e.tag}T00:00:00`)
  const von = new Date(`${heuteText}T00:00:00`)
  const inTagen = Math.round((dann.getTime() - von.getTime()) / 86_400_000)

  return {
    tag: e.tag,
    name: e.name,
    typ: e.typ,
    beschreibung: e.beschreibung,
    inTagen,
  }
}

export interface Wochentag {
  tag: string
  kuerzel: string
  streckeMeter: number
  belastung: number
  istHeute: boolean
}

const KUERZEL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export async function dieseWoche(heute = new Date()): Promise<Wochentag[]> {
  const montag = montagDerWoche(heute)
  const naechsterMontag = tageSpaeter(7, montag)

  const zeilen = await datenbank()
    .select()
    .from(aktivitaeten)
    .where(and(gte(aktivitaeten.beginn, montag), lt(aktivitaeten.beginn, naechsterMontag)))

  const heuteText = tagText(heute)

  return KUERZEL.map((kuerzel, i) => {
    const text = tagText(tageSpaeter(i, montag))
    const desTages = zeilen.filter((z) => tagText(z.beginn) === text)
    return {
      tag: text,
      kuerzel,
      streckeMeter: desTages.reduce((s, z) => s + (z.streckeMeter ?? 0), 0),
      belastung: desTages.reduce((s, z) => s + (z.belastung ?? 0), 0),
      istHeute: text === heuteText,
    }
  })
}

export async function anzahlAktivitaeten(): Promise<number> {
  const [zeile] = await datenbank()
    .select({ anzahl: sql<string>`count(*)` })
    .from(aktivitaeten)
  return Number(zeile?.anzahl ?? 0) || 0
}
