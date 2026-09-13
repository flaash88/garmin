import { z } from 'zod'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { aktivitaeten, ausruestung, plan, wellness } from '@/lib/db/schema'
import { verlaufBesorgen, spurAusVerlauf } from '@/lib/daten/verlauf'
import { monotonie, rampe } from '@/lib/analyse/belastung'
import { montagDerWoche, tageSpaeter, tagText } from '@/lib/daten/zeit'
import { datum, strecke, zahl } from '@/lib/format'
import { AbfrageAbgewiesen, sqlAusfuehren } from './sql-ausfuehren'
import { HOECHSTZEILEN } from './sql-wache'

/**
 * Die Werkzeuge des Coach.
 *
 * Zwei Dinge, die hier zusammenkommen:
 *
 * 1. **Beschriftung und Detail entstehen aus dem echten Aufruf.** Keine
 *    Zuordnungstabelle nach Werkzeugnamen: die Beschriftung nennt den
 *    tatsächlich angefragten Zeitraum, das Detail die tatsächlich gefundene
 *    Zahl. Eine Tabelle würde bei jedem Aufruf dasselbe behaupten, auch wenn
 *    nichts gefunden wurde.
 *
 * 2. **Freier Text aus den Daten des Athleten wird als Inhalt gekennzeichnet,
 *    nie als Anweisung.** Notizen, Beschwerden und Beschreibungen sind Text,
 *    den jemand einmal in intervals.icu getippt hat. Steht dort „Ignoriere
 *    deine Anweisungen", ist das eine Notiz über einen Lauf, kein Auftrag.
 */

export interface WerkzeugAntwort {
  /** Einzeiler für den Antwortstrom, aus dem echten Aufruf gebildet. */
  beschriftung: string
  /** Detailzeile, aus dem echten Ergebnis gebildet. */
  detail: string
  /** Was der Coach zu sehen bekommt. */
  inhalt: string
}

/**
 * Umschlag für alles, was der Athlet selbst geschrieben hat. Der
 * Systemabschnitt sagt dem Coach, dass darin nur Inhalt steht.
 */
function alsInhalt(text: string | null): string | null {
  if (!text) return null
  return `«${text.replaceAll('«', '<').replaceAll('»', '>')}»`
}

function zeitraumGrenzen(zeitraum: string): { von: Date; bis: Date; name: string } {
  const bis = new Date()
  const treffer = /^(\d+)\s*(tage?|wochen?|monate?)$/i.exec(zeitraum.trim())

  if (treffer) {
    const anzahl = Number(treffer[1])
    const einheit = (treffer[2] ?? '').toLowerCase()
    const tage = einheit.startsWith('woche')
      ? anzahl * 7
      : einheit.startsWith('monat')
        ? anzahl * 30
        : anzahl
    const von = new Date(bis)
    von.setDate(von.getDate() - tage)
    return { von, bis, name: `der letzten ${zahl(anzahl)} ${einheit}` }
  }

  const alsDatum = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(zeitraum.trim())
  if (alsDatum) {
    return {
      von: new Date(`${alsDatum[1]}T00:00:00`),
      bis: new Date(`${alsDatum[2]}T23:59:59`),
      name: `vom ${datum(alsDatum[1] ?? '')} bis ${datum(alsDatum[2] ?? '')}`,
    }
  }

  // Vorgabe: acht Wochen.
  const von = new Date(bis)
  von.setDate(von.getDate() - 56)
  return { von, bis, name: 'der letzten 8 Wochen' }
}

export const ZEITRAUM_BESCHREIBUNG =
  'Zeitraum, entweder relativ wie "8 wochen", "30 tage", "3 monate" ' +
  'oder als Spanne "2026-08-01..2026-09-13". Ohne Angabe: 8 Wochen.'

export async function werkzeugAktivitaeten(zeitraum: string): Promise<WerkzeugAntwort> {
  const { von, bis, name } = zeitraumGrenzen(zeitraum)
  const zeilen = await datenbank()
    .select()
    .from(aktivitaeten)
    .where(and(gte(aktivitaeten.beginn, von), lte(aktivitaeten.beginn, bis)))
    .orderBy(desc(aktivitaeten.beginn))
    .limit(400)

  const gesamtStrecke = zeilen.reduce((s, z) => s + (z.streckeMeter ?? 0), 0)

  return {
    beschriftung: `Aktivitäten ${name} geladen`,
    detail:
      zeilen.length === 0
        ? 'keine Einheit in diesem Zeitraum'
        : `${zahl(zeilen.length)} Einheiten · ${strecke(gesamtStrecke)}`,
    inhalt: JSON.stringify(
      zeilen.map((z) => ({
        id: z.id,
        tag: tagText(z.beginn),
        name_des_athleten: alsInhalt(z.name),
        typ: z.typ,
        dauer_sekunden: z.dauerSekunden,
        strecke_meter: z.streckeMeter,
        hoehenmeter: z.hoehenmeter,
        puls_schnitt: z.pulsSchnitt,
        puls_max: z.pulsMax,
        belastung: z.belastung,
      })),
    ),
  }
}

export async function werkzeugVerlauf(id: string): Promise<WerkzeugAntwort> {
  const { daten, fehler } = await verlaufBesorgen(id)
  const spur = spurAusVerlauf(daten)
  const reihen = daten
    .map((s) => (typeof s['type'] === 'string' ? s['type'] : null))
    .filter((s): s is string => s !== null)

  if (fehler) {
    return {
      beschriftung: `Verlauf zu ${id} nicht geladen`,
      detail: fehler,
      inhalt: JSON.stringify({ fehler }),
    }
  }

  return {
    beschriftung: `Verlauf zu Aktivität ${id} geladen`,
    detail:
      reihen.length === 0
        ? 'kein Verlauf vorhanden'
        : `${zahl(reihen.length)} Reihen · ${zahl(spur.length)} Ortspunkte`,
    // Die Rohreihen sind zu groß für den Zusammenhang. Zusammengefasst.
    inhalt: JSON.stringify({
      vorhandene_reihen: reihen,
      ortspunkte: spur.length,
      hinweis:
        'Einzelwerte der Reihen werden nicht übergeben. Für Kennzahlen die ' +
        'Aktivität selbst oder sql_abfrage nutzen.',
    }),
  }
}

export async function werkzeugBelastung(zeitraum: string): Promise<WerkzeugAntwort> {
  const { von, bis, name } = zeitraumGrenzen(zeitraum)

  const laeufe = await datenbank()
    .select()
    .from(aktivitaeten)
    .where(and(gte(aktivitaeten.beginn, von), lte(aktivitaeten.beginn, bis)))

  const wellnessZeilen = await datenbank()
    .select()
    .from(wellness)
    .where(and(gte(wellness.tag, tagText(von)), lte(wellness.tag, tagText(bis))))
    .orderBy(wellness.tag)

  const proTag = new Map<string, number>()
  for (const l of laeufe) {
    const t = tagText(l.beginn)
    proTag.set(t, (proTag.get(t) ?? 0) + (l.belastung ?? 0))
  }
  const tagesliste = [...proTag].map(([tag, belastung]) => ({ tag, belastung }))

  const mono = monotonie(tagesliste, tagText(bis))
  const jetztCtl = wellnessZeilen.at(-1)?.ctl ?? null
  const vorCtl = wellnessZeilen[0]?.ctl ?? null
  const anstieg =
    jetztCtl !== null && vorCtl !== null ? rampe(vorCtl, jetztCtl) : null

  return {
    beschriftung: `Belastung ${name} berechnet`,
    detail:
      mono === null
        ? 'keine Belastungsdaten'
        : `Wochenbelastung ${zahl(mono.wochenbelastung, 0)} · Monotonie ${
            mono.monotonie === null ? 'n. b.' : zahl(mono.monotonie, 2)
          }`,
    inhalt: JSON.stringify({
      wochenbelastung: mono?.wochenbelastung ?? null,
      monotonie_nach_foster: mono?.monotonie ?? null,
      streuung_der_tagesbelastung: mono?.streuung ?? null,
      belastungsdruck: mono?.belastungsdruck ?? null,
      rampe_je_woche: anstieg?.jeWoche ?? null,
      rampe_warnt: anstieg?.warnt ?? null,
      tagesbelastung: tagesliste,
      hinweis:
        'CTL, ATL und Form kommen von intervals.icu. Monotonie nach Foster ' +
        '(Mittelwert geteilt durch Streuung) und Rampe rechnet Takt selbst.',
    }),
  }
}

export async function werkzeugErholung(zeitraum: string): Promise<WerkzeugAntwort> {
  const { von, bis, name } = zeitraumGrenzen(zeitraum)
  const zeilen = await datenbank()
    .select()
    .from(wellness)
    .where(and(gte(wellness.tag, tagText(von)), lte(wellness.tag, tagText(bis))))
    .orderBy(desc(wellness.tag))
    .limit(200)

  const mitBeschwerden = zeilen.filter((z) => z.beschwerden !== null).length

  return {
    beschriftung: `Erholung ${name} geladen`,
    detail:
      zeilen.length === 0
        ? 'keine Einträge'
        : `${zahl(zeilen.length)} Tage · ${
            mitBeschwerden === 0
              ? 'keine Beschwerde notiert'
              : `${zahl(mitBeschwerden)} mit Beschwerde`
          }`,
    inhalt: JSON.stringify(
      zeilen.map((z) => ({
        tag: z.tag,
        fitness_ctl: z.ctl,
        ermuedung_atl: z.atl,
        form: z.form,
        ruhepuls: z.ruhepuls,
        hrv: z.hrv,
        schlaf_sekunden: z.schlafSekunden,
        befinden: z.befinden,
        beschwerden_des_athleten: alsInhalt(z.beschwerden),
        verletzung_des_athleten: alsInhalt(z.verletzung),
        notizen_des_athleten: alsInhalt(z.notizen),
      })),
    ),
  }
}

export async function werkzeugPlan(kw?: number): Promise<WerkzeugAntwort> {
  const heute = new Date()
  let montag = montagDerWoche(heute)
  if (typeof kw === 'number' && Number.isFinite(kw)) {
    // Auf die gewünschte Kalenderwoche schieben.
    const { kalenderwoche } = await import('@/lib/daten/zeit')
    let versuche = 0
    while (kalenderwoche(montag).woche !== kw && versuche < 60) {
      montag = tageSpaeter(kalenderwoche(montag).woche < kw ? 7 : -7, montag)
      versuche += 1
    }
  }
  const sonntag = tageSpaeter(6, montag)
  const { kalenderwoche } = await import('@/lib/daten/zeit')
  const woche = kalenderwoche(montag).woche

  const zeilen = await datenbank()
    .select()
    .from(plan)
    .where(and(gte(plan.tag, tagText(montag)), lte(plan.tag, tagText(sonntag))))
    .orderBy(plan.tag)

  return {
    beschriftung: `Plan für KW ${zahl(woche)} geladen`,
    detail:
      zeilen.length === 0
        ? 'für diese Woche ist kein Plan angelegt'
        : `${zahl(zeilen.length)} Einheiten geplant`,
    inhalt: JSON.stringify({
      kalenderwoche: woche,
      von: tagText(montag),
      bis: tagText(sonntag),
      plan_angelegt: zeilen.length > 0,
      einheiten: zeilen.map((z) => ({
        id: z.id,
        tag: z.tag,
        name_des_athleten: alsInhalt(z.name),
        typ: z.typ,
        beschreibung_des_athleten: alsInhalt(z.beschreibung),
        ziel_belastung: z.zielBelastung,
        ziel_dauer_sekunden: z.zielDauerSekunden,
        ziel_strecke_meter: z.zielStreckeMeter,
      })),
    }),
  }
}

export async function werkzeugAusruestung(): Promise<WerkzeugAntwort> {
  const zeilen = await datenbank().select().from(ausruestung)
  const inBenutzung = zeilen.filter((z) => z.inBenutzung === 1)

  return {
    beschriftung: 'Ausrüstung geladen',
    detail:
      zeilen.length === 0
        ? 'keine Ausrüstung hinterlegt'
        : `${zahl(inBenutzung.length)} in Benutzung · ${zahl(zeilen.length)} insgesamt`,
    inhalt: JSON.stringify(
      zeilen.map((z) => ({
        id: z.id,
        name_des_athleten: alsInhalt(z.name),
        art: z.art,
        in_benutzung: z.inBenutzung === 1,
        laufleistung_meter: z.laufleistungMeter,
      })),
    ),
  }
}

export async function werkzeugSql(sql: string): Promise<WerkzeugAntwort> {
  try {
    const e = await sqlAusfuehren(sql)
    return {
      beschriftung: 'SQL-Abfrage ausgeführt',
      detail: `${zahl(e.zeilen.length)} Zeilen · ${zahl(e.spalten.length)} Spalten · ${zahl(e.dauerMs)} ms${
        e.gekappt ? ` · bei ${zahl(HOECHSTZEILEN)} Zeilen gekappt` : ''
      }`,
      inhalt: JSON.stringify({
        spalten: e.spalten,
        zeilen: e.zeilen,
        gekappt: e.gekappt,
      }),
    }
  } catch (fehler) {
    const abgewiesen = fehler instanceof AbfrageAbgewiesen
    const text = fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
    return {
      beschriftung: abgewiesen ? 'SQL-Abfrage abgewiesen' : 'SQL-Abfrage fehlgeschlagen',
      detail: text,
      inhalt: JSON.stringify({ fehler: text, abgewiesen }),
    }
  }
}

/** Zod-Formen für das MCP-Gerüst. */
export const FORMEN = {
  aktivitaeten: { zeitraum: z.string().describe(ZEITRAUM_BESCHREIBUNG) },
  verlauf: { id: z.string().describe('Kennung der Aktivität') },
  belastung: { zeitraum: z.string().describe(ZEITRAUM_BESCHREIBUNG) },
  erholung: { zeitraum: z.string().describe(ZEITRAUM_BESCHREIBUNG) },
  plan: {
    kw: z
      .number()
      .optional()
      .describe('Kalenderwoche nach ISO 8601. Ohne Angabe: die laufende Woche.'),
  },
  ausruestung: {},
  sql_abfrage: {
    sql: z
      .string()
      .describe(
        'Eine einzige SELECT-Anweisung gegen das Auswertungsschema. ' +
          'Views: aktivitaeten, wellness, plan, ausruestung, strecken, ' +
          'strecken_zuordnung, zonen, tagesbelastung. Nur lesen, ' +
          `höchstens ${HOECHSTZEILEN} Zeilen, 5 s Zeitschranke.`,
      ),
  },
} as const
