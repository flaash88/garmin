import { describe, expect, it } from 'vitest'
import { splitGuete, verfall, type Split } from './splits'

const S = (sekunden: number, meter = 1000): Split => ({ sekunden, meter })

describe('splitGuete', () => {
  it('rechnet die Pace je Wiederholung in Sekunden je Kilometer', () => {
    const e = splitGuete([S(200, 1000), S(200, 1000)])
    expect(e?.paces).toEqual([200, 200])
    expect(e?.mittelPace).toBe(200)
  })

  it('rechnet auch bei Wiederholungen unter einem Kilometer richtig', () => {
    // 400 m in 80 s sind 200 s/km.
    const e = splitGuete([S(80, 400), S(80, 400)])
    expect(e?.mittelPace).toBeCloseTo(200, 6)
  })

  it('gibt bei gleichmaessigen Wiederholungen Streuung null', () => {
    const e = splitGuete([S(200), S(200), S(200), S(200)])
    expect(e?.streuung).toBe(0)
    expect(e?.streuungsmass).toBe(0)
    expect(e?.spanne).toBe(0)
  })

  it('macht das Streuungsmass ueber Geschwindigkeiten vergleichbar', () => {
    // Zwei Saetze mit derselben absoluten Streuung, aber verschiedener Pace.
    const schnell = splitGuete([S(180), S(184)])
    const langsam = splitGuete([S(360), S(364)])
    expect(schnell?.streuung).toBeCloseTo(langsam?.streuung ?? 0, 6)
    // Beim schnelleren Satz faellt dieselbe Streuung staerker ins Gewicht.
    expect(schnell?.streuungsmass).toBeGreaterThan(langsam?.streuungsmass ?? 0)
  })

  it('nennt schnellste, langsamste und Spanne', () => {
    const e = splitGuete([S(195), S(205), S(200)])
    expect(e?.schnellste).toBe(195)
    expect(e?.langsamste).toBe(205)
    expect(e?.spanne).toBe(10)
  })

  it('trennt Gleichmaessigkeit von der Zielabweichung', () => {
    // Sehr gleichmaessig, aber durchgehend 10 s/km zu langsam.
    const e = splitGuete([S(210), S(210), S(210)], 200)
    expect(e?.streuung).toBe(0)
    expect(e?.zielabweichung).toBe(10)
  })

  it('laesst die Zielabweichung null, wenn kein Ziel angegeben ist', () => {
    expect(splitGuete([S(200), S(204)])?.zielabweichung).toBeNull()
  })

  it('braucht mindestens zwei brauchbare Wiederholungen', () => {
    expect(splitGuete([S(200)])).toBeNull()
    expect(splitGuete([])).toBeNull()
    expect(splitGuete([S(0, 1000), S(200, 0)])).toBeNull()
  })

  it('laesst unbrauchbare Wiederholungen aus, statt zu scheitern', () => {
    const e = splitGuete([S(200), S(0, 1000), S(204)])
    expect(e?.anzahl).toBe(2)
  })
})

describe('verfall', () => {
  it('ist null, wenn die Pace gleich bleibt', () => {
    expect(verfall([S(200), S(200), S(200), S(200)])).toBeCloseTo(0, 9)
  })

  it('ist positiv, wenn es nach hinten raus langsamer wird', () => {
    const e = verfall([S(195), S(200), S(205), S(210)])
    expect(e).toBeGreaterThan(0)
    expect(e).toBeCloseTo(5, 6)
  })

  it('ist negativ bei einem Steigerungslauf', () => {
    expect(verfall([S(210), S(205), S(200), S(195)])).toBeLessThan(0)
  })

  it('braucht mindestens drei Wiederholungen', () => {
    expect(verfall([S(200), S(210)])).toBeNull()
  })
})
