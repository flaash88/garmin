import { describe, expect, it } from 'vitest'
import {
  monotonie,
  rampe,
  RAMPE_WARNSCHWELLE,
  zonenanteile,
  type Tagesbelastung,
} from './belastung'

function woche(werte: number[], ab = '2026-09-07'): Tagesbelastung[] {
  const start = new Date(`${ab}T00:00:00Z`)
  return werte.map((belastung, i) => {
    const tag = new Date(start)
    tag.setUTCDate(tag.getUTCDate() + i)
    return { tag: tag.toISOString().slice(0, 10), belastung }
  })
}

describe('monotonie', () => {
  it('rechnet Mittelwert durch Streuung, nicht nur die Streuung', () => {
    const tage = woche([50, 100, 50, 100, 50, 100, 50])
    const e = monotonie(tage, '2026-09-13')
    expect(e).not.toBeNull()
    expect(e?.mittel).toBeCloseTo(500 / 7, 6)
    expect(e?.monotonie).toBeCloseTo((500 / 7) / (e?.streuung ?? 1), 6)
    // Die Monotonie ist deutlich groesser als die blosse Streuung.
    expect(e?.monotonie).not.toBeCloseTo(e?.streuung ?? 0, 3)
  })

  it('gibt null zurueck, wenn alle Tage gleich sind', () => {
    // Streuung null. Die Monotonie waere unendlich, das ist keine Zahl,
    // die man anzeigen kann.
    const e = monotonie(woche([70, 70, 70, 70, 70, 70, 70]), '2026-09-13')
    expect(e?.streuung).toBe(0)
    expect(e?.monotonie).toBeNull()
    expect(e?.belastungsdruck).toBeNull()
  })

  it('zaehlt fehlende Tage als Ruhetage mit', () => {
    // Nur zwei Tage geliefert; die anderen fuenf sind Ruhe und muessen
    // die Streuung erhoehen, nicht uebersprungen werden.
    const e = monotonie(
      [
        { tag: '2026-09-09', belastung: 100 },
        { tag: '2026-09-12', belastung: 100 },
      ],
      '2026-09-13',
    )
    expect(e?.wochenbelastung).toBe(200)
    expect(e?.mittel).toBeCloseTo(200 / 7, 6)
    expect(e?.streuung).toBeGreaterThan(0)
  })

  it('beachtet nur das Fenster von sieben Tagen', () => {
    const tage = [...woche([100, 100, 100, 100, 100, 100, 100], '2026-08-01'), ...woche([10, 20, 30, 40, 50, 60, 70])]
    const e = monotonie(tage, '2026-09-13')
    expect(e?.wochenbelastung).toBe(280)
  })

  it('rechnet den Belastungsdruck als Wochenbelastung mal Monotonie', () => {
    const e = monotonie(woche([10, 20, 30, 40, 50, 60, 70]), '2026-09-13')
    expect(e?.belastungsdruck).toBeCloseTo(
      (e?.wochenbelastung ?? 0) * (e?.monotonie ?? 0),
      6,
    )
  })

  it('faengt ein unbrauchbares Datum ab', () => {
    expect(monotonie(woche([1, 2, 3, 4, 5, 6, 7]), 'kein Datum')).toBeNull()
  })
})

describe('rampe', () => {
  it('rechnet den Anstieg je Woche ueber vier Wochen', () => {
    // 20 Punkte Zuwachs in 28 Tagen sind 5 je Woche.
    const e = rampe(40, 60)
    expect(e?.gesamt).toBe(20)
    expect(e?.jeWoche).toBeCloseTo(5, 6)
  })

  it('warnt erst oberhalb von 5,0, nicht bei genau 5,0', () => {
    expect(rampe(40, 60)?.warnt).toBe(false)
    expect(rampe(40, 60.1)?.warnt).toBe(true)
    expect(RAMPE_WARNSCHWELLE).toBe(5)
  })

  it('warnt nicht bei fallender Fitness', () => {
    const e = rampe(60, 45)
    expect(e?.jeWoche).toBeLessThan(0)
    expect(e?.warnt).toBe(false)
  })

  it('faengt unbrauchbare Eingaben ab', () => {
    expect(rampe(Number.NaN, 50)).toBeNull()
    expect(rampe(40, 60, 0)).toBeNull()
  })
})

describe('zonenanteile', () => {
  it('summiert die Anteile auf eins', () => {
    const a = zonenanteile([3600, 1800, 600, 300, 100])
    expect(a.reduce((s, z) => s + z.anteil, 0)).toBeCloseTo(1, 9)
  })

  it('gibt immer fuenf Zonen zurueck, auch bei fehlenden Werten', () => {
    const a = zonenanteile([1000])
    expect(a).toHaveLength(5)
    expect(a[0]?.anteil).toBe(1)
    expect(a[4]?.sekunden).toBe(0)
  })

  it('haelt null aus, ohne durch null zu teilen', () => {
    const a = zonenanteile([0, 0, 0, 0, 0])
    expect(a.every((z) => z.anteil === 0)).toBe(true)
  })

  it('wirft negative und unbrauchbare Werte weg', () => {
    const a = zonenanteile([-100, Number.NaN, 600, 0, 0])
    expect(a[0]?.sekunden).toBe(0)
    expect(a[1]?.sekunden).toBe(0)
    expect(a[2]?.anteil).toBe(1)
  })
})
