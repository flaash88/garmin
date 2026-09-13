import { describe, expect, it } from 'vitest'
import { fortschrittZeilen, SCHRITTE, type Fortschritt } from './lauf'

function lauf(teil: Partial<Fortschritt> = {}): Fortschritt {
  return {
    aktivitaeten: 0, wellness: 0, plan: 0, ausruestung: 0, zonen: 0,
    fehler: [], warnungen: [], ...teil,
  }
}

describe('fortschrittZeilen', () => {
  it('nennt den Ausgang in der ersten Zeile, nicht die Zahlen', () => {
    // Der Befund von der Inbetriebnahme: '0 Aktivitaeten, 0 Wellness' stand
    // oben und las sich wie ein erfolgreicher Lauf mit leerem Ergebnis.
    const zeilen = fortschrittZeilen(lauf({ fehler: ['Aktivitäten: 401'] }))
    expect(zeilen[0]).toMatch(/^ABGLEICH UNVOLLSTÄNDIG/)
    expect(zeilen[0]).not.toMatch(/^ {2}Aktivitäten/)
  })

  it('unterscheidet vollstaendig gescheitert von teilweise', () => {
    const alle = Array.from({ length: SCHRITTE }, (_, i) => `Schritt ${i}: weg`)
    expect(fortschrittZeilen(lauf({ fehler: alle }))[0])
      .toBe('ABGLEICH FEHLGESCHLAGEN — kein Schritt ist durchgelaufen.')
    expect(fortschrittZeilen(lauf({ fehler: ['eins: weg'] }))[0])
      .toContain('UNVOLLSTÄNDIG')
  })

  it('meldet einen sauberen Lauf als solchen', () => {
    const zeilen = fortschrittZeilen(lauf({ aktivitaeten: 27, wellness: 61 }))
    expect(zeilen[0]).toBe('Abgleich fertig, alle Schritte durchgelaufen.')
    expect(zeilen.join('\n')).toContain('Aktivitäten  27')
    expect(zeilen.join('\n')).not.toContain('unvollständig')
  })

  it('kennzeichnet die Zahlen als unvollstaendig, wenn etwas scheiterte', () => {
    const zeilen = fortschrittZeilen(lauf({ aktivitaeten: 3, fehler: ['x: weg'] }))
    expect(zeilen.join('\n')).toContain('Geholt (unvollständig):')
  })

  it('listet jeden Fehler einzeln auf', () => {
    const zeilen = fortschrittZeilen(lauf({ fehler: ['a: eins', 'b: zwei'] }))
    expect(zeilen.filter((z) => z.startsWith('  Fehler —'))).toHaveLength(2)
  })

  it('nennt auch bei null geholten Zeilen alle fuenf Quellen', () => {
    const text = fortschrittZeilen(lauf()).join('\n')
    for (const q of ['Aktivitäten', 'Wellness', 'Plan', 'Ausrüstung', 'Zonen']) {
      expect(text).toContain(q)
    }
  })
})
