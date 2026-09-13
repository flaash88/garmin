import { describe, expect, it } from 'vitest'
import { inlineZerlegen, markdownZerlegen } from './markdown'

const text = (s: string) => markdownZerlegen(s)

describe('inlineZerlegen', () => {
  it('erkennt fett', () => {
    // Genau der Fall aus dem Betrieb: **Einordnung** stand roh da.
    expect(inlineZerlegen('**Einordnung** folgt')).toEqual([
      { art: 'fett', text: 'Einordnung' },
      { art: 'text', text: ' folgt' },
    ])
  })

  it('erkennt kursiv mit Stern und Unterstrich', () => {
    expect(inlineZerlegen('*so*')[0]).toEqual({ art: 'kursiv', text: 'so' })
    expect(inlineZerlegen('_so_')[0]).toEqual({ art: 'kursiv', text: 'so' })
  })

  it('erkennt fett mit doppeltem Unterstrich', () => {
    expect(inlineZerlegen('__so__')[0]).toEqual({ art: 'fett', text: 'so' })
  })

  it('nimmt Code vor Auszeichnung', () => {
    // Ein Sternchen in Code ist Text, keine Auszeichnung.
    expect(inlineZerlegen('`a*b*c`')).toEqual([{ art: 'code', text: 'a*b*c' }])
  })

  it('haelt einzelne Sternchen aus', () => {
    expect(inlineZerlegen('5 * 3 = 15')).toEqual([{ art: 'text', text: '5 * 3 = 15' }])
  })

  it('laesst gewoehnlichen Text in Ruhe', () => {
    expect(inlineZerlegen('Deine Rampe liegt bei 3,1.')).toEqual([
      { art: 'text', text: 'Deine Rampe liegt bei 3,1.' },
    ])
  })
})

describe('markdownZerlegen', () => {
  it('trennt Absaetze an der Leerzeile', () => {
    const b = text('Erster Absatz.\n\nZweiter Absatz.')
    expect(b).toHaveLength(2)
    expect(b.every((x) => x.art === 'absatz')).toBe(true)
  })

  it('fuegt Zeilen eines Absatzes zusammen', () => {
    const b = text('Eine Zeile\nund noch eine')
    expect(b).toHaveLength(1)
    expect(b[0]?.art === 'absatz' && b[0].teile[0]).toEqual({
      art: 'text', text: 'Eine Zeile und noch eine',
    })
  })

  it('erkennt Aufzaehlungen mit -, * und +', () => {
    for (const z of ['- eins\n- zwei', '* eins\n* zwei', '+ eins\n+ zwei']) {
      const b = text(z)
      expect(b[0]?.art).toBe('liste')
      expect(b[0]?.art === 'liste' && b[0].nummeriert).toBe(false)
      expect(b[0]?.art === 'liste' && b[0].punkte).toHaveLength(2)
    }
  })

  it('erkennt nummerierte Listen', () => {
    const b = text('1. eins\n2. zwei')
    expect(b[0]?.art === 'liste' && b[0].nummeriert).toBe(true)
  })

  it('trennt Aufzaehlung von nummerierter Liste', () => {
    const b = text('- eins\n1. zwei')
    expect(b).toHaveLength(2)
    expect(b[0]?.art === 'liste' && b[0].nummeriert).toBe(false)
    expect(b[1]?.art === 'liste' && b[1].nummeriert).toBe(true)
  })

  it('erkennt Ueberschriften und deckelt sie bei zwei Ebenen', () => {
    expect(text('# Gross')[0]).toMatchObject({ art: 'ueberschrift', ebene: 2 })
    expect(text('### Klein')[0]).toMatchObject({ art: 'ueberschrift', ebene: 3 })
    expect(text('###### Winzig')[0]).toMatchObject({ art: 'ueberschrift', ebene: 3 })
  })

  it('haelt Codebloecke zusammen', () => {
    const b = text('```\nselect 1\nselect 2\n```')
    expect(b[0]).toEqual({ art: 'codeblock', text: 'select 1\nselect 2' })
  })

  it('zeigt einen unbeendeten Codeblock trotzdem', () => {
    // Kommt beim Streamen vor: die schliessende Zeile ist noch nicht da.
    expect(text('```\nselect 1')[0]).toEqual({ art: 'codeblock', text: 'select 1' })
  })

  it('laesst ein Sternchen im Codeblock in Ruhe', () => {
    const b = text('```\nselect * from t\n```')
    expect(b[0]).toEqual({ art: 'codeblock', text: 'select * from t' })
  })

  it('haelt Leeres aus', () => {
    expect(text('')).toEqual([])
    expect(text('\n\n\n')).toEqual([])
  })

  it('gibt HTML als Text zurueck, nicht als Markup', () => {
    // Der Grund, warum kein HTML durchgelassen wird: der Text stammt aus einer
    // Antwort, die Daten des Athleten gelesen hat.
    const b = text('<img src=x onerror="alert(1)">')
    expect(b[0]?.art).toBe('absatz')
    expect(b[0]?.art === 'absatz' && b[0].teile).toEqual([
      { art: 'text', text: '<img src=x onerror="alert(1)">' },
    ])
  })

  it('bildet eine vollstaendige Coach-Antwort ab', () => {
    const b = text(
      '**Einordnung**\n\nDeine Rampe liegt bei 3,1 je Woche.\n\n' +
      '- Montag: Ruhe\n- Dienstag: 5 × 1000 m\n\nMehr dazu in `belastung`.',
    )
    expect(b.map((x) => x.art)).toEqual(['absatz', 'absatz', 'liste', 'absatz'])
  })
})
