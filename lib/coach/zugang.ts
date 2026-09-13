/**
 * Zugang des Coach.
 *
 * Takt spricht Claude über das Claude-Code-Abo an, nicht über einen
 * API-Schlüssel. Der Token kommt aus `CLAUDE_CODE_OAUTH_TOKEN` und wird
 * interaktiv mit `claude setup-token` erzeugt.
 *
 * `ANTHROPIC_API_KEY` wird **nirgends** gesetzt. Das SDK führt beide
 * Variablen in derselben Gruppe und entscheidet nach Reihenfolge; sind beide
 * gesetzt, hängt an dieser Reihenfolge, welches Konto die Nutzung trägt.
 * Eine Quelle, keine Mehrdeutigkeit.
 */

export const TOKEN_VARIABLE = 'CLAUDE_CODE_OAUTH_TOKEN'
export const TOKEN_PRAEFIX = 'sk-ant-oat01-'

export type ZugangsZustand =
  | { art: 'da'; token: string }
  | { art: 'fehlt' }
  | { art: 'unbrauchbar'; grund: string }

export function zugangPruefen(
  roh: string | undefined = process.env[TOKEN_VARIABLE],
): ZugangsZustand {
  const token = roh?.trim()
  if (!token) return { art: 'fehlt' }

  if (!token.startsWith(TOKEN_PRAEFIX)) {
    /*
     * Ein API-Schlüssel (sk-ant-api…) an dieser Stelle ist der häufigste
     * Vertipper. Er würde sogar funktionieren — nur eben über das falsche
     * Konto abgerechnet. Deshalb abweisen statt durchlassen.
     */
    const anfang = token.slice(0, 12)
    return {
      art: 'unbrauchbar',
      grund: `${TOKEN_VARIABLE} beginnt mit «${anfang}…» statt mit «${TOKEN_PRAEFIX}». Erzeugen mit: claude setup-token`,
    }
  }

  if (token.length < 40) {
    return { art: 'unbrauchbar', grund: `${TOKEN_VARIABLE} ist zu kurz.` }
  }

  return { art: 'da', token }
}

/** Fehler, der eigens behandelt wird — nicht als allgemeiner Fehler. */
export class ZugangAbgelaufen extends Error {
  constructor(override readonly message = 'Zugang abgelaufen — Token neu erzeugen') {
    super(message)
    this.name = 'ZugangAbgelaufen'
  }
}

/**
 * Erkennt an der Meldung, ob der Zugang das Problem ist.
 *
 * Die Erkennung ist notgedrungen an Textmustern festgemacht: das SDK reicht
 * den Fehler der Gegenseite als Zeichenkette durch, nicht als Klasse. Die
 * Liste ist bewusst breit — lieber einmal zu viel „Zugang abgelaufen" als ein
 * abgelaufener Token, der als allgemeiner Fehler erscheint und den Nutzer
 * ratlos lässt.
 */
const ZUGANGSMUSTER = [
  /\b401\b/,
  /\b403\b/,
  /unauthorized/i,
  /authentication[_ -]?error/i,
  /invalid[_ -]?api[_ -]?key/i,
  /oauth[^.]{0,40}(expired|invalid|revoked)/i,
  /token[^.]{0,20}(expired|abgelaufen|revoked|invalid)/i,
  /please run[^.]{0,20}(claude )?login/i,
  /credentials?[^.]{0,20}(expired|invalid|missing)/i,
]

export function istZugangsfehler(fehler: unknown): boolean {
  if (fehler instanceof ZugangAbgelaufen) return true
  const text =
    fehler instanceof Error ? fehler.message : typeof fehler === 'string' ? fehler : ''
  if (text.length === 0) return false
  return ZUGANGSMUSTER.some((m) => m.test(text))
}

/**
 * Meldung fürs Hochfahren. Gibt `null` zurück, wenn alles stimmt — sonst den
 * Text, der ins Protokoll gehört.
 */
export function startmeldung(zustand: ZugangsZustand = zugangPruefen()): string | null {
  if (zustand.art === 'da') return null
  if (zustand.art === 'fehlt') {
    return (
      `${TOKEN_VARIABLE} ist nicht gesetzt. Der Coach antwortet nicht, alles ` +
      `andere läuft.\n` +
      `  Token erzeugen:  claude setup-token\n` +
      `  Dann in .env eintragen und den Verbund neu starten.`
    )
  }
  return `${TOKEN_VARIABLE} ist unbrauchbar: ${zustand.grund}`
}
