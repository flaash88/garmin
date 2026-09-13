import { coachFragen, type CoachEreignis } from './agent'
import { vorschlagAnlegen } from '@/lib/daten/planvorschlaege'
import { zielLesen, zielSatz, type Ziel } from '@/lib/daten/einstellungen'
import { montagDerWoche, tageSpaeter, tagText } from '@/lib/daten/zeit'
import { datum, zahl } from '@/lib/format'

/**
 * Der Plan entsteht hier, nicht anderswo.
 *
 * Bestellt wird ein Block über 4 bis 16 Wochen. Der Coach liest die Daten mit
 * seinen gewohnten Werkzeugen und legt die Einheiten über `plan_vorschlagen`
 * in Takt ab. Nach intervals.icu geht davon **nichts**: dazwischen steht die
 * Freigabe des Athleten.
 */

export const WOCHEN_MIN = 4
export const WOCHEN_MAX = 16
export const WOCHEN_VORGABE = 8

export function wochenPruefen(wert: unknown): number {
  const n = typeof wert === 'number' ? Math.round(wert) : Number.NaN
  if (!Number.isFinite(n)) return WOCHEN_VORGABE
  return Math.min(WOCHEN_MAX, Math.max(WOCHEN_MIN, n))
}

export interface Planbestellung {
  wochen: number
  /** Ziel nur für diese Bestellung. Leer: das Ziel aus dem Athletenprofil. */
  ziel?: string | null
  /** Freie Hinweise des Athleten, etwa «Dienstag kann ich nie». */
  hinweis?: string | null
  /** Ab wann der Block läuft. Vorgabe: der kommende Montag. */
  abTag?: string
}

export function bestellungGrenzen(bestellung: Planbestellung, heute = new Date()): {
  vonTag: string
  bisTag: string
} {
  if (bestellung.abTag) {
    const von = new Date(`${bestellung.abTag}T00:00:00`)
    if (!Number.isNaN(von.getTime())) {
      return {
        vonTag: tagText(von),
        bisTag: tagText(tageSpaeter(bestellung.wochen * 7 - 1, von)),
      }
    }
  }
  // Der kommende Montag: die laufende Woche ist schon gelaufen.
  const naechsterMontag = tageSpaeter(7, montagDerWoche(heute))
  return {
    vonTag: tagText(naechsterMontag),
    bisTag: tagText(tageSpaeter(bestellung.wochen * 7 - 1, naechsterMontag)),
  }
}

export function auftragstext(
  bestellung: Planbestellung,
  grenzen: { vonTag: string; bisTag: string },
  ziel: Ziel,
): string {
  const teile: string[] = []

  teile.push(`Stell einen Trainingsblock über ${zahl(bestellung.wochen)} Wochen auf,
vom ${datum(grenzen.vonTag)} bis zum ${datum(grenzen.bisTag)}.`)

  const eigenesZiel = bestellung.ziel?.trim()
  if (eigenesZiel) {
    teile.push(`Ziel für diesen Block: ${eigenesZiel}

Das gilt für diese Bestellung und geht dem Ziel im Athletenprofil vor.`)
  } else {
    const ausProfil = zielSatz(ziel)
    teile.push(
      ausProfil
        ? `Ziel: ${ausProfil}`
        : `Es ist kein Ziel hinterlegt. Bau den Block auf allgemeine Grundlage
und Beständigkeit auf, und sag im ersten Satz, dass ein Ziel fehlt.`,
    )
  }

  const hinweis = bestellung.hinweis?.trim()
  if (hinweis) {
    /*
     * Der Hinweis kommt vom Athleten selbst und wird als Inhalt gekennzeichnet
     * — derselbe Umgang wie mit Notizen aus intervals.icu.
     */
    teile.push(`Hinweise des Athleten: «${hinweis.replaceAll('«', '<').replaceAll('»', '>')}»`)
  }

  teile.push(`So gehst du vor:

1. Sieh dir zuerst die Daten an: Belastung und Erholung der letzten Wochen,
   die zuletzt gelaufenen Einheiten, den bestehenden Plan im Zeitraum.
2. Ruf dann plan_vorschlagen auf. Du darfst mehrmals aufrufen — etwa eine
   Woche je Aufruf. Alle Tage müssen im Block liegen; alles davor oder danach
   wird abgewiesen.
3. Gib bei jeder Einheit eine Beschreibung mit, die auch ohne Takt zu
   verstehen ist: Aufbau, Zielpace, Pausen. Sie geht mit nach intervals.icu.
4. Setz ersetzt_plan_id nur, wenn eine bestehende Einheit wirklich weichen
   soll. Das kostet den Athleten eine eigene Bestätigung.
5. Schreib zum Schluss in zwei, drei Sätzen, worauf der Aufbau hinausläuft
   und woran du ihn im Verlauf festmachen würdest.

Nichts davon geht nach intervals.icu. Der Athlet gibt jede Einheit einzeln
oder im Block frei.`)

  return teile.join('\n\n')
}

/**
 * Legt den Satz an und lässt den Coach ihn füllen.
 *
 * Der Satz entsteht **vor** dem Lauf: geht der Strom unterwegs verloren,
 * stehen die schon vorgeschlagenen Einheiten trotzdem in der Datenbank und
 * überstehen einen Neubau des Behälters.
 */
export async function* planBestellen(
  bestellung: Planbestellung,
  entscheidungMelden?: (e: { name: string; erlaubt: boolean }) => void,
): AsyncGenerator<CoachEreignis> {
  const grenzen = bestellungGrenzen(bestellung)
  const ziel = await zielLesen()
  const eigenesZiel = bestellung.ziel?.trim()

  const vorschlagId = await vorschlagAnlegen({
    ziel: eigenesZiel && eigenesZiel.length > 0 ? eigenesZiel : (zielSatz(ziel) ?? null),
    vonTag: grenzen.vonTag,
    bisTag: grenzen.bisTag,
    wochen: bestellung.wochen,
  })

  // Zuerst die Kennung: bricht der Strom später ab, ist der Satz auffindbar.
  yield { art: 'vorschlag', id: vorschlagId }
  yield {
    art: 'werkzeug',
    id: 'satz',
    beschriftung: `Plansatz über ${zahl(bestellung.wochen)} Wochen angelegt`,
    detail: `${datum(grenzen.vonTag)} bis ${datum(grenzen.bisTag)}`,
    laeuft: false,
  }

  for await (const e of coachFragen(
    auftragstext(bestellung, grenzen, ziel),
    [],
    entscheidungMelden,
    { vorschlagId, vonTag: grenzen.vonTag, bisTag: grenzen.bisTag },
  )) {
    yield e
  }
}
