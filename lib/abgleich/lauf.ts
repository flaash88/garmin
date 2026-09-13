import { sql } from 'drizzle-orm'
import { datenbank } from '@/lib/db'
import { abgleich, aktivitaeten, ausruestung, feldbefuellung, plan, wellness, zonen } from '@/lib/db/schema'
import { befuellungZaehlen, istSatz, type Rohsatz } from '@/lib/icu/felder'
import {
  aktivitaetenHolen,
  ausruestungHolen,
  planHolen,
  wellnessHolen,
  zonenHolen,
} from '@/lib/icu/endpunkte'
import { zugangAusUmgebung, type IcuZugang } from '@/lib/icu/klient'
import {
  aktivitaetUmwandeln,
  ausruestungUmwandeln,
  planUmwandeln,
  wellnessUmwandeln,
  zonenUmwandeln,
} from './umwandeln'
import { istLeerbefund, leerbefund } from './leerbefund'

/**
 * Der Abgleich ist ein eigener Vorgang, kein Nebeneffekt einer Anfrage.
 * Angestoßen wird er vom Webhook oder vom stündlichen Zeitplan; die
 * Oberfläche liest nur, was hier abgelegt wurde.
 */

/** Zahl der Schritte eines vollständigen Laufs. */
export const SCHRITTE = 5

/**
 * Was ein Schritt zurückgibt.
 *
 * `geholt` und `geschrieben` stehen getrennt da, weil der Unterschied
 * zwischen beiden der eigentliche Befund ist: kam nichts an, ist nichts zu
 * tun; kam etwas an und blieb nichts übrig, hat die Auswertung die Antwort
 * nicht verstanden. Siehe lib/abgleich/leerbefund.ts.
 */
export interface Schrittergebnis {
  geholt: number
  geschrieben: number
  /** Die Rohsätze — für den Befund im Fall «geholt > 0, geschrieben = 0». */
  roh: unknown[]
}

/**
 * Felder, von denen die jeweilige Auswertung mindestens eines braucht.
 *
 * Steht hier und nicht im Umwandler, weil der Befund genau diese Liste der
 * Antwort gegenüberstellt — die Gegenüberstellung ist der Hinweis.
 */
export const PFLICHTFELDER: Record<string, string[]> = {
  aktivitaeten: ['id', 'start_date_local', 'start_date'],
  wellness: ['id', 'date', 'day'],
  plan: ['id', 'start_date_local', 'start_date', 'date'],
  ausruestung: ['id', 'name'],
  zonen: ['types', 'type'],
}

/**
 * Fasst einen Lauf in Zeilen, die den Ausgang **zuerst** nennen.
 *
 * Vorher standen die Zahlen oben und die Fehler darunter. Ein Lauf, bei dem
 * alles scheiterte, las sich damit wie ein erfolgreicher Lauf mit leerem
 * Ergebnis — «0 Aktivitäten, 0 Wellness» —, und die Fehler wirkten wie eine
 * Fußnote. Jetzt steht in der ersten Zeile, woran man ist.
 */
export function fortschrittZeilen(f: Fortschritt): string[] {
  const schritte = SCHRITTE
  const zeilen: string[] = []

  if (f.fehler.length >= schritte) {
    zeilen.push('ABGLEICH FEHLGESCHLAGEN — kein Schritt ist durchgelaufen.')
  } else if (f.fehler.length > 0) {
    zeilen.push(
      `ABGLEICH UNVOLLSTÄNDIG — ${f.fehler.length} von ${schritte} Schritten gescheitert.`,
    )
  } else if (f.warnungen.length > 0) {
    /*
     * Ein Schritt, der nichts verstanden hat, ist nicht «fertig». Geworfen
     * hat er auch nicht — deshalb eine eigene Stufe zwischen fertig und
     * gescheitert, und sie steht oben, nicht als Fußnote.
     */
    zeilen.push(
      `ABGLEICH OHNE ERGEBNIS — ${f.warnungen.length} von ${schritte} Schritten ` +
        'haben Daten geholt und nichts gespeichert.',
    )
  } else {
    zeilen.push('Abgleich fertig, alle Schritte durchgelaufen.')
  }

  for (const fehler of f.fehler) zeilen.push(`  Fehler — ${fehler}`)
  for (const warnung of f.warnungen) zeilen.push(`  Warnung — ${warnung}`)

  if (f.fehler.length > 0 || f.warnungen.length > 0) zeilen.push('')
  zeilen.push(f.fehler.length > 0 ? 'Geholt (unvollständig):' : 'Geholt:')
  zeilen.push(`  Aktivitäten  ${f.aktivitaeten}`)
  zeilen.push(`  Wellness     ${f.wellness}`)
  zeilen.push(`  Plan         ${f.plan}`)
  zeilen.push(`  Ausrüstung   ${f.ausruestung}`)
  zeilen.push(`  Zonen        ${f.zonen}`)

  return zeilen
}

export interface Fortschritt {
  /** Tatsächliche Zahlen, keine Platzhalter. */
  aktivitaeten: number
  wellness: number
  plan: number
  ausruestung: number
  zonen: number
  fehler: string[]
  /**
   * Schritte, die Daten geholt und nichts gespeichert haben. Kein Fehler —
   * aber auch kein Erfolg.
   */
  warnungen: string[]
}

function leererFortschritt(): Fortschritt {
  return {
    aktivitaeten: 0,
    wellness: 0,
    plan: 0,
    ausruestung: 0,
    zonen: 0,
    fehler: [],
    warnungen: [],
  }
}

function tagText(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function tageZurueck(tage: number, ab = new Date()): Date {
  const d = new Date(ab)
  d.setUTCDate(d.getUTCDate() - tage)
  return d
}

/** Ab wann neu geholt wird. Etwas Überlappung, damit nichts durchfällt. */
const UEBERLAPPUNG_TAGE = 3

async function standLesen(quelle: string): Promise<Date | null> {
  const zeilen = await datenbank()
    .select()
    .from(abgleich)
    .where(sql`${abgleich.quelle} = ${quelle}`)
    .limit(1)
  return zeilen[0]?.bisEinschliesslich ?? null
}

async function standSchreiben(
  quelle: string,
  bis: Date,
  fehler: string | null,
): Promise<void> {
  await datenbank()
    .insert(abgleich)
    .values({ quelle, bisEinschliesslich: bis, zuletztAm: new Date(), zuletztFehler: fehler })
    .onConflictDoUpdate({
      target: abgleich.quelle,
      set: { bisEinschliesslich: bis, zuletztAm: new Date(), zuletztFehler: fehler },
    })
}

export async function aktivitaetenAbgleichen(
  zugang: IcuZugang,
  vonTag?: string,
): Promise<Schrittergebnis> {
  const stand = await standLesen('aktivitaeten')
  const von = vonTag ?? tagText(stand ? tageZurueck(UEBERLAPPUNG_TAGE, stand) : tageZurueck(365))
  const bis = tagText(new Date())

  const roh = await aktivitaetenHolen(zugang, von, bis)
  const zeilen = roh.map(aktivitaetUmwandeln).filter((z) => z !== null)

  for (const zeile of zeilen) {
    await datenbank()
      .insert(aktivitaeten)
      .values(zeile)
      .onConflictDoUpdate({ target: aktivitaeten.id, set: { ...zeile, geholtAm: new Date() } })
  }

  await standSchreiben('aktivitaeten', new Date(), null)
  return { geholt: roh.length, geschrieben: zeilen.length, roh }
}

export async function wellnessAbgleichen(
  zugang: IcuZugang,
  vonTag?: string,
): Promise<Schrittergebnis & { saetze: Rohsatz[] }> {
  const stand = await standLesen('wellness')
  const von = vonTag ?? tagText(stand ? tageZurueck(UEBERLAPPUNG_TAGE, stand) : tageZurueck(365))
  const bis = tagText(new Date())

  const roh = await wellnessHolen(zugang, von, bis)
  const zeilen = roh.map(wellnessUmwandeln).filter((z) => z !== null)

  for (const zeile of zeilen) {
    await datenbank()
      .insert(wellness)
      .values(zeile)
      .onConflictDoUpdate({ target: wellness.tag, set: { ...zeile, geholtAm: new Date() } })
  }

  await standSchreiben('wellness', new Date(), null)
  return {
    geholt: roh.length,
    geschrieben: zeilen.length,
    roh,
    saetze: roh.filter(istSatz),
  }
}

export async function planAbgleichen(zugang: IcuZugang): Promise<Schrittergebnis> {
  // Plan reicht in die Zukunft; rückwärts genügt ein Monat für den Vergleich
  // von geplant und gelaufen.
  const von = tagText(tageZurueck(30))
  const bis = tagText(tageZurueck(-120))

  const roh = await planHolen(zugang, von, bis)
  const zeilen = roh.map(planUmwandeln).filter((z) => z !== null)

  for (const zeile of zeilen) {
    await datenbank()
      .insert(plan)
      .values(zeile)
      .onConflictDoUpdate({ target: plan.id, set: { ...zeile, geholtAm: new Date() } })
  }

  await standSchreiben('plan', new Date(), null)
  return { geholt: roh.length, geschrieben: zeilen.length, roh }
}

export async function ausruestungAbgleichen(zugang: IcuZugang): Promise<Schrittergebnis> {
  const roh = await ausruestungHolen(zugang)
  const zeilen = roh.map(ausruestungUmwandeln).filter((z) => z !== null)

  for (const zeile of zeilen) {
    await datenbank()
      .insert(ausruestung)
      .values(zeile)
      .onConflictDoUpdate({ target: ausruestung.id, set: { ...zeile, geholtAm: new Date() } })
  }

  await standSchreiben('ausruestung', new Date(), null)
  return { geholt: roh.length, geschrieben: zeilen.length, roh }
}

export async function zonenAbgleichen(zugang: IcuZugang): Promise<Schrittergebnis> {
  const roh = await zonenHolen(zugang)

  /*
   * Ein Satz je Gruppe wird zu einer Zeile je Sportart. Rad- und Laufwerte
   * unterscheiden sich; wer Läufe auswertet, muss die Laufwerte finden,
   * ohne die Gruppe kennen zu müssen.
   */
  const zeilen = roh.flatMap(zonenUmwandeln)

  for (const zeile of zeilen) {
    await datenbank()
      .insert(zonen)
      .values(zeile)
      .onConflictDoUpdate({ target: zonen.sportart, set: { ...zeile, geholtAm: new Date() } })
  }

  await standSchreiben('zonen', new Date(), null)
  return { geholt: roh.length, geschrieben: zeilen.length, roh }
}

/**
 * Hält fest, welche Wellness-Felder über den geholten Bestand überhaupt
 * befüllt waren. Grundlage für E0.8: dauerhaft leere Felder werden in der
 * Oberfläche ausgeblendet statt mit einem Strich gezeigt.
 */
export async function befuellungFesthalten(quelle: string, saetze: readonly Rohsatz[]): Promise<void> {
  if (saetze.length === 0) return
  const zaehler = befuellungZaehlen(saetze)
  const zeilen = [...zaehler].map(([feld, stand]) => ({
    quelle,
    feld,
    befuellt: stand.befuellt,
    gesamt: stand.gesamt,
  }))
  if (zeilen.length === 0) return

  // Löschen und Einfügen in einer Transaktion. Sonst stünde die Tabelle nach
  // einem Fehlschlag dazwischen leer da, und E0.8 liesse sich bis zum
  // nächsten vollständigen Lauf nicht beantworten.
  await datenbank().transaction(async (tx) => {
    await tx.delete(feldbefuellung).where(sql`${feldbefuellung.quelle} = ${quelle}`)
    await tx.insert(feldbefuellung).values(zeilen)
  })
}

/** Ein vollständiger Durchlauf. Verläufe kommen bewusst nicht mit. */
export async function abgleichLaufen(vonTag?: string): Promise<Fortschritt> {
  const fortschritt = leererFortschritt()

  /*
   * Fehlt der Zugang, ist das ein Fehlschlag des ganzen Laufs — kein Grund
   * für einen Stapelauszug. Vorher warf die Prüfung aus der Funktion heraus,
   * und der Aufrufer bekam eine nackte Ausnahme statt eines Berichts.
   */
  let zugang
  try {
    zugang = zugangAusUmgebung()
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
    for (const name of ['Aktivitäten', 'Wellness', 'Plan', 'Ausrüstung', 'Zonen']) {
      fortschritt.fehler.push(`${name}: ${text}`)
    }
    return fortschritt
  }

  /*
   * Jeder Schritt gibt zurück, wie viel ankam und wie viel blieb. Der
   * Vergleich der beiden Zahlen ist die Warnung — nicht die zweite Zahl
   * allein.
   */
  const schritte: Array<[string, string, () => Promise<Schrittergebnis>]> = [
    ['Aktivitäten', 'aktivitaeten', async () => {
      const e = await aktivitaetenAbgleichen(zugang, vonTag)
      fortschritt.aktivitaeten = e.geschrieben
      return e
    }],
    ['Wellness', 'wellness', async () => {
      const e = await wellnessAbgleichen(zugang, vonTag)
      fortschritt.wellness = e.geschrieben
      await befuellungFesthalten('wellness', e.saetze)
      return e
    }],
    ['Plan', 'plan', async () => {
      const e = await planAbgleichen(zugang)
      fortschritt.plan = e.geschrieben
      return e
    }],
    ['Ausrüstung', 'ausruestung', async () => {
      const e = await ausruestungAbgleichen(zugang)
      fortschritt.ausruestung = e.geschrieben
      return e
    }],
    ['Zonen', 'zonen', async () => {
      const e = await zonenAbgleichen(zugang)
      fortschritt.zonen = e.geschrieben
      return e
    }],
  ]

  // Ein gescheiterter Schritt hält die anderen nicht auf. Was geholt werden
  // konnte, liegt danach da; der Fehler steht im Ergebnis und in der Tabelle.
  for (const [name, quelle, schritt] of schritte) {
    try {
      const ergebnis = await schritt()

      /*
       * Nicht geworfen, aber auch nichts verstanden. Das als Erfolg zu
       * melden hat schon dreimal einen Befund verdeckt — Ortspunkte,
       * Wellness-Felder, Zonen. Jetzt steht der Grund dabei, nicht nur die
       * Null.
       */
      if (istLeerbefund(ergebnis.geholt, ergebnis.geschrieben)) {
        const grund = leerbefund(name, ergebnis.roh, PFLICHTFELDER[quelle] ?? [])
        fortschritt.warnungen.push(grund)
        try {
          await standSchreiben(quelle, new Date(), grund)
        } catch {
          // Steht die Datenbank still, ist der Befund im Ergebnis genug.
        }
      }
    } catch (fehler) {
      const text = fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
      fortschritt.fehler.push(`${name}: ${text}`)
      // Der Fehler muss auch in der Tabelle landen, sonst sieht die
      // Oberfläche später einen Abgleich, der nie durchlief.
      try {
        await standSchreiben(quelle, new Date(), text)
      } catch {
        // Steht die Datenbank still, ist der Fehler im Ergebnis genug.
      }
    }
  }

  return fortschritt
}

/** Erstbefüllung: zwölf Monate Aktivitäten und Wellness, ohne Verläufe. */
export async function erstbefuellung(): Promise<Fortschritt> {
  return abgleichLaufen(tagText(tageZurueck(365)))
}
