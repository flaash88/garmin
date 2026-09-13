import { describe, expect, it } from 'vitest'
import { istLeerbefund, leerbefund } from './leerbefund'

describe('istLeerbefund', () => {
  it('schlaegt an, wenn Saetze ankamen und nichts blieb', () => {
    expect(istLeerbefund(4, 0)).toBe(true)
  })

  it('schweigt bei einer leeren Antwort', () => {
    // Nichts geholt, nichts geschrieben — das ist kein Befund, sondern Ruhe.
    expect(istLeerbefund(0, 0)).toBe(false)
  })

  it('schweigt, wenn etwas geschrieben wurde', () => {
    expect(istLeerbefund(4, 4)).toBe(false)
    expect(istLeerbefund(4, 1)).toBe(false)
  })
})

describe('leerbefund', () => {
  /** Der echte Fall: die Sportarten stehen unter types, gelesen wurde type. */
  const SPORT_SETTINGS = [
    {
      id: 1,
      athlete_id: 'i1',
      types: ['Run', 'VirtualRun', 'TrailRun'],
      lthr: 165,
      max_hr: 196,
      hr_zones: [130, 148, 162, 177, 184, 192, 196],
      hr_zone_names: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'],
      threshold_pace: 3.4,
      pace_zones: [1, 2, 3],
    },
  ]

  it('nennt die Zahl der geholten Saetze', () => {
    expect(leerbefund('Zonen', SPORT_SETTINGS, ['type'])).toContain('1 Satz geholt')
    expect(leerbefund('Zonen', [...SPORT_SETTINGS, ...SPORT_SETTINGS], ['type'])).toContain(
      '2 Sätze geholt',
    )
  })

  it('sagt, dass das erwartete Feld fehlt — und nennt die vorhandenen', () => {
    const text = leerbefund('Zonen', SPORT_SETTINGS, ['type'])
    expect(text).toContain('keines davon ist da')
    // Der Befund muss das richtige Feld nennen, sonst hilft er nicht.
    expect(text).toContain('types')
  })

  it('sagt es anders, wenn die Felder da sind und trotzdem nichts herauskam', () => {
    const text = leerbefund('Zonen', SPORT_SETTINGS, ['types'])
    expect(text).toContain('types ist da')
    expect(text).toContain('unbrauchbar')
  })

  it('beklagt kein fehlendes Zweitfeld, wenn eines der erwarteten da ist', () => {
    // Gebraucht wird eines, nicht alle. «types» ist da, also liegt es an den
    // Werten — «type fehlt» waere hier eine falsche Spur.
    const text = leerbefund('Zonen', SPORT_SETTINGS, ['types', 'type'])
    expect(text).toContain('types ist da')
    expect(text).not.toContain('keines davon ist da')
  })

  it('kommt ohne hinterlegte Pflichtfelder zurecht', () => {
    const text = leerbefund('Zonen', SPORT_SETTINGS, [])
    expect(text).toContain('nicht hinterlegt')
  })

  it('kommt mit einer Antwort ohne Objekte zurecht', () => {
    const text = leerbefund('Zonen', ['a', 'b'], ['types'])
    expect(text).toContain('keine auswertbaren Sätze')
  })

  it('kuerzt eine sehr lange Feldliste und sagt, wie viele es sind', () => {
    const breit = [Object.fromEntries([...Array(40)].map((_, i) => [`f${i}`, i]))]
    const text = leerbefund('Wellness', breit, ['id'])
    expect(text).toContain('(40 Felder)')
    expect(text).not.toContain('f39,')
  })
})
