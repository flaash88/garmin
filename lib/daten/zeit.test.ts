import { describe, expect, it } from 'vitest'
import { kalenderwoche, montagDerWoche, tagText } from './zeit'

describe('kalenderwoche', () => {
  it('zaehlt nach ISO 8601', () => {
    // 13.09.2026 ist ein Sonntag und gehoert zur KW 37.
    expect(kalenderwoche(new Date(2026, 8, 13))).toEqual({ jahr: 2026, woche: 37 })
    // Der Montag darauf beginnt die KW 38.
    expect(kalenderwoche(new Date(2026, 8, 14))).toEqual({ jahr: 2026, woche: 38 })
  })

  it('ordnet den Jahreswechsel nach ISO zu, nicht nach Kalenderjahr', () => {
    // 01.01.2027 ist ein Freitag und gehoert noch zur KW 53 von 2026.
    expect(kalenderwoche(new Date(2027, 0, 1))).toEqual({ jahr: 2026, woche: 53 })
    // 29.12.2025 ist ein Montag und gehoert schon zur KW 1 von 2026.
    expect(kalenderwoche(new Date(2025, 11, 29))).toEqual({ jahr: 2026, woche: 1 })
  })
})

describe('montagDerWoche', () => {
  it('gibt zum Sonntag den Montag davor', () => {
    expect(tagText(montagDerWoche(new Date(2026, 8, 13)))).toBe('2026-09-07')
  })

  it('gibt zum Montag denselben Tag', () => {
    expect(tagText(montagDerWoche(new Date(2026, 8, 14)))).toBe('2026-09-14')
  })
})

describe('montagDerWoche und tagText passen zusammen', () => {
  it('liefert einen Montag, den tagText auch als Montag liest', () => {
    // Der Fehler, den das abfaengt: UTC-Mitternacht zurueckgeben und
    // oertlich weiterlesen. Westlich von Greenwich waere das der Sonntag
    // davor, und die ganze Planwoche verschoebe sich um einen Tag.
    for (const tag of [11, 12, 13, 14, 15, 16, 17]) {
      const montag = montagDerWoche(new Date(2026, 8, tag))
      expect(montag.getDay()).toBe(1)
      const gelesen = new Date(`${tagText(montag)}T00:00:00`)
      expect(gelesen.getDay()).toBe(1)
    }
  })

  it('deckt sieben Tage ohne Luecke und ohne Doppelung ab', () => {
    const montag = montagDerWoche(new Date(2026, 8, 13))
    const tage = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(montag)
      d.setDate(d.getDate() + i)
      return tagText(d)
    })
    expect(new Set(tage).size).toBe(7)
    expect(tage[0]).toBe('2026-09-07')
    expect(tage[6]).toBe('2026-09-13')
  })
})
