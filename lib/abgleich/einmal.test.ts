import { beforeEach, describe, expect, it } from 'vitest'
import { einmalZugleich, vorgaengeVergessen } from './einmal'

function verzoegert<T>(wert: T, ms: number): () => Promise<T> {
  return () => new Promise((fertig) => setTimeout(() => fertig(wert), ms))
}

beforeEach(() => {
  vorgaengeVergessen()
})

describe('einmalZugleich', () => {
  it('startet einen Vorgang und meldet das', async () => {
    const e = await einmalZugleich('a', verzoegert(7, 1))
    expect(e).toEqual({ wert: 7, gestartet: true })
  })

  it('startet bei gleichzeitigen Aufrufen nur einen', async () => {
    // Der Fall aus dem Betrieb: zweimal auf den Knopf geklickt.
    let laeufe = 0
    const lauf = () => {
      laeufe += 1
      return new Promise<number>((fertig) => setTimeout(() => fertig(laeufe), 40))
    }

    const [a, b, c] = await Promise.all([
      einmalZugleich('abgleich', lauf),
      einmalZugleich('abgleich', lauf),
      einmalZugleich('abgleich', lauf),
    ])

    expect(laeufe).toBe(1)
    expect([a.gestartet, b.gestartet, c.gestartet].filter(Boolean)).toHaveLength(1)
    // Alle drei bekommen dasselbe Ergebnis, keiner eine Absage.
    expect([a.wert, b.wert, c.wert]).toEqual([1, 1, 1])
  })

  it('laesst einen neuen Vorgang zu, sobald der alte durch ist', async () => {
    const erste = await einmalZugleich('a', verzoegert(1, 5))
    const zweite = await einmalZugleich('a', verzoegert(2, 5))
    expect(erste.gestartet).toBe(true)
    expect(zweite.gestartet).toBe(true)
    expect(zweite.wert).toBe(2)
  })

  it('haelt verschiedene Schluessel auseinander', async () => {
    let a = 0
    let b = 0
    await Promise.all([
      einmalZugleich('a', async () => { a += 1 }),
      einmalZugleich('b', async () => { b += 1 }),
    ])
    expect([a, b]).toEqual([1, 1])
  })

  it('raeumt auch nach einem Fehlschlag auf', async () => {
    await expect(
      einmalZugleich('a', () => Promise.reject(new Error('weg'))),
    ).rejects.toThrow('weg')
    // Sonst bliebe der Schluessel besetzt und nichts liesse sich mehr starten.
    const danach = await einmalZugleich('a', verzoegert(3, 1))
    expect(danach).toEqual({ wert: 3, gestartet: true })
  })

  it('reicht den Fehlschlag an alle Wartenden weiter', async () => {
    const lauf = () =>
      new Promise<number>((_, scheitern) =>
        setTimeout(() => scheitern(new Error('weg')), 20),
      )
    const beide = Promise.all([
      einmalZugleich('a', lauf).catch((f: Error) => f.message),
      einmalZugleich('a', lauf).catch((f: Error) => f.message),
    ])
    expect(await beide).toEqual(['weg', 'weg'])
  })
})
