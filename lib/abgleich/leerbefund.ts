import { istSatz } from '@/lib/icu/felder'

/**
 * Ein Schritt, der nichts geschrieben hat, obwohl die Antwort nicht leer war.
 *
 * Das ist kein Erfolg. Dreimal ist genau das durchgegangen — Ortspunkte,
 * Wellness-Felder, Zonen —, jedes Mal mit derselben Meldung: eine Null neben
 * dem Namen und «alle Schritte durchgelaufen». Die Null sah aus wie «nichts
 * Neues da», war aber «nichts verstanden».
 *
 * Hier entsteht die Warnung, die den Unterschied benennt: wie viele Sätze
 * ankamen, welche Felder die Auswertung braucht und welche der erste Satz
 * tatsächlich führt. Genau die Gegenüberstellung, die jeden der drei Befunde
 * sofort gezeigt hätte.
 */

/** Wie viele Feldnamen eines Beispielsatzes genannt werden. */
const FELDER_ZEIGEN = 14

function felderVon(satz: unknown): string[] {
  return istSatz(satz) ? Object.keys(satz) : []
}

export function leerbefund(
  name: string,
  roh: readonly unknown[],
  /** Feldnamen, von denen die Auswertung mindestens einen braucht. */
  erwartet: readonly string[],
): string {
  const beispiel = roh.find((s) => istSatz(s))
  const felder = felderVon(beispiel)

  const teile: string[] = [
    `${name}: ${roh.length} ${roh.length === 1 ? 'Satz' : 'Sätze'} geholt, ` +
      `nichts gespeichert.`,
  ]

  if (felder.length === 0) {
    teile.push(
      'Die Antwort enthält keine auswertbaren Sätze — kein Objekt, nur Werte ' +
        'oder leere Einträge.',
    )
    return teile.join(' ')
  }

  /*
   * Gebraucht wird **eines** der erwarteten Felder, nicht alle. Ist eines da,
   * liegt es nicht an den Namen, sondern an den Werten — und der Befund muss
   * das sagen, statt ein fehlendes Zweitfeld zu beklagen, auf das es nie
   * ankam.
   */
  const vorhanden = erwartet.filter((f) => felder.includes(f))

  if (erwartet.length === 0) {
    teile.push('Für diese Quelle ist nicht hinterlegt, welche Felder gebraucht werden.')
  } else if (vorhanden.length === 0) {
    teile.push(
      `Erwartet wird mindestens eines der Felder ${erwartet.join(', ')} — ` +
        'keines davon ist da.',
    )
  } else {
    teile.push(
      `${vorhanden.join(', ')} ist da — dann sind die Werte darin unbrauchbar.`,
    )
  }

  const gezeigt = felder.slice(0, FELDER_ZEIGEN)
  teile.push(
    `Der erste Satz führt: ${gezeigt.join(', ')}` +
      (felder.length > gezeigt.length ? ` … (${felder.length} Felder)` : '') +
      '.',
  )

  return teile.join(' ')
}

/**
 * Ob ein Schritt eine Warnung verdient: es kam etwas an, es blieb nichts
 * übrig.
 */
export function istLeerbefund(geholt: number, geschrieben: number): boolean {
  return geholt > 0 && geschrieben === 0
}
