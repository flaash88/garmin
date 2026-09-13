import { beforeEach, describe, expect, it } from 'vitest'
import { alleZuruecksetzen, fehlversuchNotieren, verzug, zuruecksetzen } from './versuche'

const IP = '192.0.2.1'
const T = Date.UTC(2026, 8, 13, 12, 0, 0)

describe('verzug', () => {
  beforeEach(() => {
    alleZuruecksetzen()
  })

  it('laesst die ersten beiden Versuche ohne Verzoegerung', () => {
    expect(verzug(IP, T)).toBe(0)
    fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBe(0)
  })

  it('verzoegert ab dem dritten Versuch mit 1 s, 2 s, 4 s', () => {
    fehlversuchNotieren(IP, T)
    fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBe(1000)

    fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBe(2000)

    fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBe(4000)
  })

  it('deckelt die Verzoegerung', () => {
    for (let i = 0; i < 40; i += 1) fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBe(30_000)
  })

  it('haelt die Zaehler je IP getrennt', () => {
    const andere = '198.51.100.7'
    for (let i = 0; i < 5; i += 1) fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBeGreaterThan(0)
    expect(verzug(andere, T)).toBe(0)
  })

  it('vergisst nach einer Viertelstunde Ruhe', () => {
    for (let i = 0; i < 5; i += 1) fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBeGreaterThan(0)
    expect(verzug(IP, T + 15 * 60 * 1000 + 1)).toBe(0)
  })

  it('faengt nach der Ruhezeit wieder bei eins an', () => {
    for (let i = 0; i < 5; i += 1) fehlversuchNotieren(IP, T)
    const spaeter = T + 15 * 60 * 1000 + 1
    fehlversuchNotieren(IP, spaeter)
    expect(verzug(IP, spaeter)).toBe(0)
  })

  it('setzt nach erfolgreicher Anmeldung zurueck', () => {
    for (let i = 0; i < 5; i += 1) fehlversuchNotieren(IP, T)
    zuruecksetzen(IP)
    expect(verzug(IP, T)).toBe(0)
  })
})
