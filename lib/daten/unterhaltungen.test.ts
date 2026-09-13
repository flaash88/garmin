import { describe, expect, it } from 'vitest'
import { titelAus } from './unterhaltungen'

describe('titelAus', () => {
  it('nimmt eine kurze Frage unveraendert', () => {
    expect(titelAus('Wie war meine Woche?')).toBe('Wie war meine Woche?')
  })

  it('macht aus mehreren Zeilen eine', () => {
    expect(titelAus('Wie war\n\n  meine  Woche?')).toBe('Wie war meine Woche?')
  })

  it('kuerzt an der Wortgrenze, nicht mitten im Wort', () => {
    const lang = 'Kannst du mir bitte erklaeren warum meine Monotonie diese Woche ' +
      'so hoch ausgefallen ist obwohl ich zwei Ruhetage hatte'
    const t = titelAus(lang)
    expect(t.length).toBeLessThanOrEqual(81)
    expect(t.endsWith('…')).toBe(true)
    // Kein abgeschnittenes Wort vor dem Auslassungszeichen.
    expect(t.slice(0, -1).endsWith(' ')).toBe(false)
    expect(lang.startsWith(t.slice(0, -1))).toBe(true)
  })

  it('kuerzt hart, wenn es keine Wortgrenze gibt', () => {
    const t = titelAus('x'.repeat(200))
    expect(t.length).toBe(81)
  })

  it('faengt eine leere Frage ab', () => {
    expect(titelAus('')).toBe('Ohne Titel')
    expect(titelAus('   \n  ')).toBe('Ohne Titel')
  })
})
