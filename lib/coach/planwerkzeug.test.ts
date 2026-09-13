import { describe, expect, it } from 'vitest'
import { einheitPruefen } from './planwerkzeug'

const AUFTRAG = { vorschlagId: 'v1', vonTag: '2026-09-14', bisTag: '2026-11-08' }

describe('einheitPruefen', () => {
  it('nimmt eine Einheit im Block an', () => {
    const g = einheitPruefen(
      { tag: '2026-09-16', name: '5 × 1000 m', dauer_minuten: 60, strecke_km: 12 },
      AUFTRAG,
    )
    expect('einheit' in g).toBe(true)
    if (!('einheit' in g)) return
    expect(g.einheit.tag).toBe('2026-09-16')
    expect(g.einheit.dauerSekunden).toBe(3600)
    expect(g.einheit.streckeMeter).toBe(12000)
    // Vorgabe, wenn nichts angegeben ist.
    expect(g.einheit.typ).toBe('Run')
  })

  it('weist einen Tag vor dem Block ab, statt ihn zurechtzubiegen', () => {
    const g = einheitPruefen({ tag: '2026-09-13', name: 'Lauf' }, AUFTRAG)
    expect('fehler' in g).toBe(true)
    if ('fehler' in g) expect(g.fehler).toContain('außerhalb')
  })

  it('weist einen Tag nach dem Block ab', () => {
    const g = einheitPruefen({ tag: '2026-11-09', name: 'Lauf' }, AUFTRAG)
    expect('fehler' in g).toBe(true)
  })

  it('nimmt die Randtage an', () => {
    expect('einheit' in einheitPruefen({ tag: '2026-09-14', name: 'A' }, AUFTRAG)).toBe(true)
    expect('einheit' in einheitPruefen({ tag: '2026-11-08', name: 'B' }, AUFTRAG)).toBe(true)
  })

  it('weist einen Tag in falscher Form ab', () => {
    const g = einheitPruefen({ tag: '16.09.2026', name: 'Lauf' }, AUFTRAG)
    expect('fehler' in g).toBe(true)
    if ('fehler' in g) expect(g.fehler).toContain('JJJJ-MM-TT')
  })

  it('weist eine Einheit ohne Namen ab', () => {
    const g = einheitPruefen({ tag: '2026-09-16', name: '   ' }, AUFTRAG)
    expect('fehler' in g).toBe(true)
  })

  it('uebernimmt ersetzt_plan_id nur, wenn wirklich etwas drinsteht', () => {
    const leer = einheitPruefen(
      { tag: '2026-09-16', name: 'A', ersetzt_plan_id: '  ' },
      AUFTRAG,
    )
    expect('einheit' in leer && leer.einheit.ersetztPlanId).toBeUndefined()

    const gesetzt = einheitPruefen(
      { tag: '2026-09-16', name: 'A', ersetzt_plan_id: ' e42 ' },
      AUFTRAG,
    )
    expect('einheit' in gesetzt && gesetzt.einheit.ersetztPlanId).toBe('e42')
  })

  it('faellt bei leerem Typ auf Run zurueck', () => {
    const g = einheitPruefen({ tag: '2026-09-16', name: 'A', typ: '  ' }, AUFTRAG)
    expect('einheit' in g && g.einheit.typ).toBe('Run')
  })

  it('rundet Minuten und Kilometer auf ganze Sekunden und Meter', () => {
    const g = einheitPruefen(
      { tag: '2026-09-16', name: 'A', dauer_minuten: 42.5, strecke_km: 10.55 },
      AUFTRAG,
    )
    expect('einheit' in g && g.einheit.dauerSekunden).toBe(2550)
    expect('einheit' in g && g.einheit.streckeMeter).toBe(10550)
  })
})
