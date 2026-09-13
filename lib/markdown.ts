/**
 * Kleiner Markdown-Wandler für die Antworten des Coach.
 *
 * Bewusst ohne Bibliothek und bewusst **ohne HTML-Durchlass**: die Antwort
 * kommt von einem Modell, das Daten des Athleten gelesen hat — und darin kann
 * Text stehen, den jemand eingeschleust hat. Ein Wandler, der rohes HTML
 * übernimmt, würde daraus eine Lücke machen.
 *
 * Deshalb: der Text wird in Bausteine zerlegt, und die Oberfläche baut daraus
 * React-Elemente. Es gibt keinen Weg, über den eine Zeichenkette zu Markup
 * wird — `dangerouslySetInnerHTML` kommt nirgends vor.
 *
 * Unterstützt wird, was der Coach tatsächlich schreibt: Absätze, Überschriften,
 * Aufzählungen, nummerierte Listen, **fett**, *kursiv*, `Code`.
 */

export type Inline =
  | { art: 'text'; text: string }
  | { art: 'fett'; text: string }
  | { art: 'kursiv'; text: string }
  | { art: 'code'; text: string }

export type Baustein =
  | { art: 'absatz'; teile: Inline[] }
  | { art: 'ueberschrift'; ebene: 2 | 3; teile: Inline[] }
  | { art: 'liste'; nummeriert: boolean; punkte: Inline[][] }
  | { art: 'codeblock'; text: string }

/**
 * Zerlegt eine Zeile in fett, kursiv, Code und gewöhnlichen Text.
 *
 * Der Code-Fall wird zuerst gesucht: steht ein Sternchen in `…`, ist es Text
 * und keine Auszeichnung.
 */
export function inlineZerlegen(zeile: string): Inline[] {
  const teile: Inline[] = []
  let rest = zeile

  const muster =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)/

  for (;;) {
    const treffer = muster.exec(rest)
    if (!treffer || treffer.index === undefined) break

    if (treffer.index > 0) {
      teile.push({ art: 'text', text: rest.slice(0, treffer.index) })
    }

    const gefunden = treffer[0]
    if (gefunden.startsWith('`')) {
      teile.push({ art: 'code', text: gefunden.slice(1, -1) })
    } else if (gefunden.startsWith('**') || gefunden.startsWith('__')) {
      teile.push({ art: 'fett', text: gefunden.slice(2, -2) })
    } else {
      teile.push({ art: 'kursiv', text: gefunden.slice(1, -1) })
    }

    rest = rest.slice(treffer.index + gefunden.length)
  }

  if (rest.length > 0) teile.push({ art: 'text', text: rest })
  return teile.length > 0 ? teile : [{ art: 'text', text: '' }]
}

const AUFZAEHLUNG = /^\s*[-*+]\s+(.*)$/
const NUMMERIERT = /^\s*\d+[.)]\s+(.*)$/
const UEBERSCHRIFT = /^(#{1,6})\s+(.*)$/

export function markdownZerlegen(roh: string): Baustein[] {
  const zeilen = roh.replaceAll('\r\n', '\n').split('\n')
  const bausteine: Baustein[] = []

  let absatz: string[] = []
  let liste: { nummeriert: boolean; punkte: string[] } | null = null
  let codeblock: string[] | null = null

  function absatzSchliessen() {
    if (absatz.length === 0) return
    bausteine.push({ art: 'absatz', teile: inlineZerlegen(absatz.join(' ').trim()) })
    absatz = []
  }

  function listeSchliessen() {
    if (!liste) return
    bausteine.push({
      art: 'liste',
      nummeriert: liste.nummeriert,
      punkte: liste.punkte.map((p) => inlineZerlegen(p)),
    })
    liste = null
  }

  for (const zeile of zeilen) {
    // Codeblock hat Vorrang vor allem anderen.
    if (zeile.trimStart().startsWith('```')) {
      if (codeblock === null) {
        absatzSchliessen()
        listeSchliessen()
        codeblock = []
      } else {
        bausteine.push({ art: 'codeblock', text: codeblock.join('\n') })
        codeblock = null
      }
      continue
    }
    if (codeblock !== null) {
      codeblock.push(zeile)
      continue
    }

    if (zeile.trim().length === 0) {
      absatzSchliessen()
      listeSchliessen()
      continue
    }

    const ueberschrift = UEBERSCHRIFT.exec(zeile)
    if (ueberschrift) {
      absatzSchliessen()
      listeSchliessen()
      // Mehr als zwei Ebenen braucht eine Coach-Antwort nicht.
      const ebene = (ueberschrift[1] ?? '#').length <= 2 ? 2 : 3
      bausteine.push({
        art: 'ueberschrift',
        ebene: ebene as 2 | 3,
        teile: inlineZerlegen(ueberschrift[2] ?? ''),
      })
      continue
    }

    const punkt = AUFZAEHLUNG.exec(zeile)
    const nummer = NUMMERIERT.exec(zeile)
    if (punkt || nummer) {
      absatzSchliessen()
      const nummeriert = Boolean(nummer)
      const text = (punkt?.[1] ?? nummer?.[1] ?? '').trim()
      if (liste && liste.nummeriert !== nummeriert) listeSchliessen()
      if (!liste) liste = { nummeriert, punkte: [] }
      liste.punkte.push(text)
      continue
    }

    listeSchliessen()
    absatz.push(zeile.trim())
  }

  // Ein unbeendeter Codeblock — das kommt beim Streamen vor — wird trotzdem
  // gezeigt, statt verloren zu gehen.
  if (codeblock !== null) bausteine.push({ art: 'codeblock', text: codeblock.join('\n') })
  absatzSchliessen()
  listeSchliessen()

  return bausteine
}
