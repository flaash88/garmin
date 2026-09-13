import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZugangAbgelaufen } from './zugang'

/**
 * Der Zeitplan darf an einem abgelaufenen Token nicht hängenbleiben. Geprüft
 * wird der Weg, nicht die Attrappe: `analyseErzeugen` liest den Strom von
 * `coachFragen`, und was dabei herauskommt, entscheidet, was der Aufrufer
 * sieht.
 */

const ereignisse: Array<Record<string, unknown>> = []

vi.mock('./agent', () => ({
  MODELL: 'claude-opus-5',
  coachFragen: async function* () {
    for (const e of ereignisse) yield e
  },
}))

vi.mock('@/lib/db', () => ({ datenbank: () => { throw new Error('nicht erwartet') } }))

beforeEach(() => {
  ereignisse.length = 0
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('analyseErzeugen', () => {
  it('setzt den Text aus den Stuecken des Stroms zusammen', async () => {
    ereignisse.push(
      { art: 'text', text: 'Diese Woche ' },
      { art: 'text', text: '52 km.' },
      { art: 'ende' },
    )
    const { analyseErzeugen } = await import('./analysen')
    const e = await analyseErzeugen('wochenbriefing', '2026-KW37')
    expect(e.text).toBe('Diese Woche 52 km.')
  })

  it('sammelt die echten Werkzeugzeilen ein', async () => {
    ereignisse.push(
      { art: 'werkzeug', beschriftung: 'Belastung der letzten 8 Wochen berechnet',
        detail: 'Wochenbelastung 312 · Monotonie 1,84' },
      { art: 'text', text: 'Bericht.' },
      { art: 'ende' },
    )
    const { analyseErzeugen } = await import('./analysen')
    const e = await analyseErzeugen('wochenbriefing', '2026-KW37')
    expect(e.werkzeugaufrufe).toEqual([
      { beschriftung: 'Belastung der letzten 8 Wochen berechnet',
        detail: 'Wochenbelastung 312 · Monotonie 1,84' },
    ])
  })

  it('wirft ZugangAbgelaufen, wenn der Strom den Zugang meldet', async () => {
    // Genau dieser Typ laesst den Zeitplan weiterlaufen statt anzuhalten.
    ereignisse.push({ art: 'zugang', text: 'Zugang abgelaufen — Token neu erzeugen' })
    const { analyseErzeugen } = await import('./analysen')
    await expect(analyseErzeugen('wochenbriefing', '2026-KW37'))
      .rejects.toBeInstanceOf(ZugangAbgelaufen)
  })

  it('haelt einen Zugangsfehler von einem allgemeinen Fehler auseinander', async () => {
    ereignisse.push({ art: 'fehler', text: 'Netz weg' })
    const { analyseErzeugen } = await import('./analysen')
    await expect(analyseErzeugen('wochenbriefing', '2026-KW37'))
      .rejects.not.toBeInstanceOf(ZugangAbgelaufen)
  })

  it('wirft, wenn gar kein Text kam', async () => {
    ereignisse.push({ art: 'ende' })
    const { analyseErzeugen } = await import('./analysen')
    await expect(analyseErzeugen('wochenbriefing', '2026-KW37'))
      .rejects.toThrow('keine Antwort')
  })
})

describe('briefingBezug', () => {
  it('bildet die Kalenderwoche nach ISO 8601 ab', async () => {
    const { briefingBezug } = await import('./analysen')
    expect(briefingBezug(new Date(2026, 8, 13))).toBe('2026-KW37')
    expect(briefingBezug(new Date(2026, 8, 14))).toBe('2026-KW38')
    // Jahreswechsel nach ISO: der 01.01.2027 gehoert noch zu 2026.
    expect(briefingBezug(new Date(2027, 0, 1))).toBe('2026-KW53')
  })

  it('fuellt die Wochenzahl auf zwei Stellen', async () => {
    const { briefingBezug } = await import('./analysen')
    expect(briefingBezug(new Date(2026, 0, 8))).toBe('2026-KW02')
  })
})
