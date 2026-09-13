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

  it('zaehlt je IP weiter, aber der Topf ueber alles setzt den Boden', () => {
    const andere = '198.51.100.7'
    for (let i = 0; i < 5; i += 1) fehlversuchNotieren(IP, T)

    // Die fremde IP hat selbst nichts verbockt, wird aber nicht auf null
    // gesetzt — sonst genuegte ein Wechsel der behaupteten Herkunft.
    expect(verzug(andere, T)).toBe(verzug(IP, T))

    // Der eigene Zaehler laeuft trotzdem mit: weitere Fehlversuche nur von
    // der einen IP treiben den Verzug weiter hoch.
    const vorher = verzug(IP, T)
    fehlversuchNotieren(IP, T)
    expect(verzug(IP, T)).toBeGreaterThan(vorher)
  })

  it('laesst sich nicht durch staendig neue Herkunft umgehen', () => {
    // Der Angriff, den der Zaehler je IP allein nicht abfaengt: bei jeder
    // Anfrage eine andere IP behaupten. Frueher blieb der Verzug dabei bei
    // null, weil jeder Versuch in einem frischen Topf landete.
    for (let i = 0; i < 12; i += 1) fehlversuchNotieren(`203.0.113.${i}`, T)
    expect(verzug('203.0.113.99', T)).toBeGreaterThan(0)
    expect(verzug('ohne-herkunft', T)).toBeGreaterThan(0)
  })

  it('vergisst auch den Topf ueber alles nach der Ruhezeit', () => {
    for (let i = 0; i < 12; i += 1) fehlversuchNotieren(`203.0.113.${i}`, T)
    expect(verzug('203.0.113.99', T + 15 * 60 * 1000 + 1)).toBe(0)
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

  it('setzt nach erfolgreicher Anmeldung beide Zaehler zurueck', () => {
    for (let i = 0; i < 5; i += 1) fehlversuchNotieren(IP, T)
    zuruecksetzen(IP)
    expect(verzug(IP, T)).toBe(0)
    // Auch der Topf ueber alles, sonst bliebe der Eigentümer nach der
    // eigenen erfolgreichen Anmeldung weiter gebremst.
    expect(verzug('198.51.100.7', T)).toBe(0)
  })
})
