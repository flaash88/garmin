import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { planeinheiten, planvorschlaege } from '@/lib/db/schema'

/**
 * Plansätze, die der Coach vorschlägt.
 *
 * Vier Zustände je Einheit, und **kein stiller Nachlauf** zwischen ihnen:
 *
 *   vorschlag    — steht da, nichts ist geschrieben worden.
 *   freigegeben  — die Freigabe ist erfolgt, die Übertragung gescheitert.
 *                  `fehler` sagt warum. Der einzige Weg hier heraus ist ein
 *                  neuer Versuch von Hand.
 *   uebertragen  — in intervals.icu angelegt, `icuEventId` ist die Kennung.
 *   verworfen    — abgelehnt. Sieben Tage sichtbar, dann weg.
 *
 * Die Freigabe überträgt sofort; scheitert sie, sieht man den Grund. Ein
 * Hintergrundlauf, der es später noch einmal versucht, würde den Fehlschlag
 * verschleiern.
 */

export type Zustand = 'vorschlag' | 'freigegeben' | 'uebertragen' | 'verworfen'

export const ZUSTAENDE: Record<Zustand, string> = {
  vorschlag: 'Vorschlag',
  freigegeben: 'Freigegeben',
  uebertragen: 'Übertragen',
  verworfen: 'Verworfen',
}

/** Nach dieser Frist verschwinden verworfene Sätze von selbst. */
export const VERWORFEN_TAGE = 7

export interface Planeinheit {
  id: string
  vorschlagId: string
  tag: string
  name: string
  typ: string
  beschreibung: string | null
  dauerSekunden: number | null
  streckeMeter: number | null
  zielBelastung: number | null
  ersetztPlanId: string | null
  ersetztGeloeschtAm: Date | null
  zustand: Zustand
  icuEventId: string | null
  fehler: string | null
  uebertragenAm: Date | null
  reihenfolge: number
}

export interface Planvorschlag {
  id: string
  ziel: string | null
  vonTag: string
  bisTag: string
  wochen: number
  begruendung: string | null
  erstelltAm: Date
  verworfenAm: Date | null
}

export interface Planvorschlagsatz {
  vorschlag: Planvorschlag
  einheiten: Planeinheit[]
}

function kennung(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function alsZustand(wert: string): Zustand {
  return wert === 'freigegeben' || wert === 'uebertragen' || wert === 'verworfen'
    ? wert
    : 'vorschlag'
}

export async function vorschlagAnlegen(satz: {
  ziel: string | null
  vonTag: string
  bisTag: string
  wochen: number
}): Promise<string> {
  const id = kennung()
  await datenbank().insert(planvorschlaege).values({ id, ...satz })
  return id
}

export async function begruendungAblegen(id: string, begruendung: string): Promise<void> {
  await datenbank()
    .update(planvorschlaege)
    .set({ begruendung })
    .where(eq(planvorschlaege.id, id))
}

export interface NeueEinheit {
  tag: string
  name: string
  typ?: string
  beschreibung?: string | null
  dauerSekunden?: number | null
  streckeMeter?: number | null
  zielBelastung?: number | null
  ersetztPlanId?: string | null
}

/** Hängt Einheiten an einen Satz an. Gibt zurück, wie viele es jetzt sind. */
export async function einheitenAnhaengen(
  vorschlagId: string,
  neue: NeueEinheit[],
): Promise<number> {
  if (neue.length === 0) return einheitenZaehlen(vorschlagId)

  const bisher = await einheitenZaehlen(vorschlagId)
  await datenbank()
    .insert(planeinheiten)
    .values(
      neue.map((e, i) => ({
        id: kennung() + '-' + i.toString(36),
        vorschlagId,
        tag: e.tag,
        name: e.name,
        typ: e.typ ?? 'Run',
        beschreibung: e.beschreibung ?? null,
        dauerSekunden: e.dauerSekunden ?? null,
        streckeMeter: e.streckeMeter ?? null,
        zielBelastung: e.zielBelastung ?? null,
        ersetztPlanId: e.ersetztPlanId ?? null,
        reihenfolge: bisher + i,
      })),
    )
  return bisher + neue.length
}

export async function einheitenZaehlen(vorschlagId: string): Promise<number> {
  const zeilen = await datenbank()
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(planeinheiten)
    .where(eq(planeinheiten.vorschlagId, vorschlagId))
  return zeilen[0]?.anzahl ?? 0
}

function alsEinheit(z: typeof planeinheiten.$inferSelect): Planeinheit {
  return {
    id: z.id,
    vorschlagId: z.vorschlagId,
    tag: z.tag,
    name: z.name,
    typ: z.typ,
    beschreibung: z.beschreibung,
    dauerSekunden: z.dauerSekunden,
    streckeMeter: z.streckeMeter,
    zielBelastung: z.zielBelastung,
    ersetztPlanId: z.ersetztPlanId,
    ersetztGeloeschtAm: z.ersetztGeloeschtAm,
    zustand: alsZustand(z.zustand),
    icuEventId: z.icuEventId,
    fehler: z.fehler,
    uebertragenAm: z.uebertragenAm,
    reihenfolge: z.reihenfolge,
  }
}

export async function vorschlagLesen(id: string): Promise<Planvorschlagsatz | null> {
  const kopf = await datenbank()
    .select()
    .from(planvorschlaege)
    .where(eq(planvorschlaege.id, id))
    .limit(1)
  if (!kopf[0]) return null

  const zeilen = await datenbank()
    .select()
    .from(planeinheiten)
    .where(eq(planeinheiten.vorschlagId, id))
    .orderBy(asc(planeinheiten.tag), asc(planeinheiten.reihenfolge))

  return { vorschlag: kopf[0], einheiten: zeilen.map(alsEinheit) }
}

export async function einheitLesen(id: string): Promise<Planeinheit | null> {
  const zeilen = await datenbank()
    .select()
    .from(planeinheiten)
    .where(eq(planeinheiten.id, id))
    .limit(1)
  return zeilen[0] ? alsEinheit(zeilen[0]) : null
}

/** Alle Sätze, neueste zuerst. Verworfene bleiben dabei — eingeklappt. */
export async function vorschlaegeListe(grenze = 10): Promise<Planvorschlagsatz[]> {
  const koepfe = await datenbank()
    .select()
    .from(planvorschlaege)
    .orderBy(desc(planvorschlaege.erstelltAm))
    .limit(grenze)
  if (koepfe.length === 0) return []

  const zeilen = await datenbank()
    .select()
    .from(planeinheiten)
    .where(
      inArray(
        planeinheiten.vorschlagId,
        koepfe.map((k) => k.id),
      ),
    )
    .orderBy(asc(planeinheiten.tag), asc(planeinheiten.reihenfolge))

  return koepfe.map((k) => ({
    vorschlag: k,
    einheiten: zeilen.filter((z) => z.vorschlagId === k.id).map(alsEinheit),
  }))
}

/**
 * Einheiten, die im Wochenraster neben dem bestehenden Plan stehen sollen.
 *
 * Verworfene sind ausdrücklich nicht dabei: sie bleiben sieben Tage sichtbar,
 * aber eingeklappt beim Satz, nicht im Raster.
 */
export async function einheitenImZeitraum(
  vonTag: string,
  bisTag: string,
): Promise<Planeinheit[]> {
  const zeilen = await datenbank()
    .select()
    .from(planeinheiten)
    .where(
      and(
        gte(planeinheiten.tag, vonTag),
        lte(planeinheiten.tag, bisTag),
        sql`${planeinheiten.zustand} <> 'verworfen'`,
      ),
    )
    .orderBy(asc(planeinheiten.tag), asc(planeinheiten.reihenfolge))
  return zeilen.map(alsEinheit)
}

export async function zustandSetzen(
  id: string,
  zustand: Zustand,
  dazu: { icuEventId?: string | null; fehler?: string | null } = {},
): Promise<void> {
  await datenbank()
    .update(planeinheiten)
    .set({
      zustand,
      ...(dazu.icuEventId === undefined ? {} : { icuEventId: dazu.icuEventId }),
      // Ein alter Fehler darf nach einem geglückten zweiten Versuch nicht
      // stehenbleiben.
      fehler: dazu.fehler ?? null,
      ...(zustand === 'uebertragen' ? { uebertragenAm: new Date() } : {}),
      ...(zustand === 'verworfen' ? { verworfenAm: new Date() } : {}),
    })
    .where(eq(planeinheiten.id, id))
}

/** Merken, dass die zu ersetzende Einheit in intervals.icu gelöscht ist. */
export async function ersetztGeloeschtMerken(id: string): Promise<void> {
  await datenbank()
    .update(planeinheiten)
    .set({ ersetztGeloeschtAm: new Date() })
    .where(eq(planeinheiten.id, id))
}

export async function einheitVerwerfen(id: string): Promise<void> {
  await zustandSetzen(id, 'verworfen')
}

/**
 * Einen ganzen Satz verwerfen.
 *
 * Was schon übertragen ist, bleibt wie es ist: in intervals.icu steht es, und
 * ein Zustand «verworfen» würde etwas anderes behaupten.
 */
export async function vorschlagVerwerfen(id: string): Promise<void> {
  const jetzt = new Date()
  await datenbank()
    .update(planeinheiten)
    .set({ zustand: 'verworfen', verworfenAm: jetzt })
    .where(
      and(
        eq(planeinheiten.vorschlagId, id),
        sql`${planeinheiten.zustand} <> 'uebertragen'`,
      ),
    )
  await datenbank()
    .update(planvorschlaege)
    .set({ verworfenAm: jetzt })
    .where(eq(planvorschlaege.id, id))
}

/**
 * Verworfene Sätze, die älter als sieben Tage sind, entfernen.
 *
 * **Sätze mit übertragenen Einheiten bleiben.** Sie sind das einzige, was in
 * Takt festhält, wie eine Einheit in den Kalender gekommen ist; sie über die
 * Kaskade mitzunehmen hiesse, diesen Beleg wegzuwerfen, während die Einheit
 * in intervals.icu weiter steht.
 *
 * Gibt die Zahl der gelöschten Sätze zurück. Die Einheiten gehen über
 * `onDelete: 'cascade'` mit.
 */
export async function verworfeneAufraeumen(jetzt: Date = new Date()): Promise<number> {
  const grenze = new Date(jetzt.getTime() - VERWORFEN_TAGE * 86_400_000)
  const weg = await datenbank()
    .delete(planvorschlaege)
    .where(
      and(
        sql`${planvorschlaege.verworfenAm} is not null`,
        lte(planvorschlaege.verworfenAm, grenze),
        sql`not exists (select 1 from ${planeinheiten}
              where ${planeinheiten.vorschlagId} = ${planvorschlaege.id}
                and ${planeinheiten.zustand} = 'uebertragen')`,
      ),
    )
    .returning({ id: planvorschlaege.id })
  return weg.length
}
