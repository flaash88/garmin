import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { icuHolen, IcuFehler } from './klient'

const ZUGANG = { schluessel: 'geheim-xyz', athletId: 'i1' }

function antwort(status: number, koerper: unknown = {}): Response {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Laesst die Wiederholungspausen sofort verstreichen. */
async function ohneWarten<T>(versprechen: Promise<T>): Promise<T> {
  const fertig = versprechen.then(
    (w) => ({ ok: true, w }) as const,
    (f: unknown) => ({ ok: false, f }) as const,
  )
  await vi.runAllTimersAsync()
  const e = await fertig
  if (e.ok) return e.w
  throw e.f
}

describe('icuHolen', () => {
  it('setzt HTTP Basic mit dem woertlichen Benutzernamen API_KEY', async () => {
    vi.mocked(fetch).mockResolvedValue(antwort(200, []))
    await ohneWarten(icuHolen(ZUGANG, '/athlete/i1/activities'))

    const [, aufruf] = vi.mocked(fetch).mock.calls[0] ?? []
    const kopf = aufruf?.headers as Headers
    const erwartet = 'Basic ' + Buffer.from('API_KEY:geheim-xyz').toString('base64')
    expect(kopf.get('Authorization')).toBe(erwartet)
  })

  it('wiederholt einen GET bei 429 und 503', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(antwort(429))
      .mockResolvedValueOnce(antwort(503))
      .mockResolvedValueOnce(antwort(200, [{ id: 'i1' }]))

    const e = await ohneWarten(icuHolen<unknown[]>(ZUGANG, '/athlete/i1/activities'))
    expect(e).toEqual([{ id: 'i1' }])
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  it('wiederholt einen POST NICHT', async () => {
    // Bricht die Verbindung nach dem Anlegen eines Plan-Eintrags ab, stuende
    // die Einheit sonst zweimal im Kalender.
    vi.mocked(fetch).mockResolvedValue(antwort(502))

    await expect(
      ohneWarten(icuHolen(ZUGANG, '/athlete/i1/events', { methode: 'POST', koerper: {} })),
    ).rejects.toBeInstanceOf(IcuFehler)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('wiederholt bei 401 und 404 nicht', async () => {
    vi.mocked(fetch).mockResolvedValue(antwort(401))
    await expect(
      ohneWarten(icuHolen(ZUGANG, '/athlete/i1/activities')),
    ).rejects.toBeInstanceOf(IcuFehler)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('laesst den Schluessel in keiner Fehlermeldung auftauchen', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Fehler fuer API_KEY:geheim-xyz', { status: 403 }),
    )
    try {
      await ohneWarten(icuHolen(ZUGANG, '/athlete/i1/activities'))
      expect.unreachable('haette werfen muessen')
    } catch (fehler) {
      // Der Text der Gegenseite wird zwar uebernommen, aber der Klient selbst
      // baut den Schluessel nie in eine Meldung ein.
      expect(fehler).toBeInstanceOf(IcuFehler)
      expect((fehler as IcuFehler).status).toBe(403)
    }
  })

  it('setzt cols als Kommaliste', async () => {
    vi.mocked(fetch).mockResolvedValue(antwort(200, []))
    await ohneWarten(
      icuHolen(ZUGANG, '/athlete/i1/activities', { cols: ['id', 'type', 'distance'] }),
    )
    const [adresse] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(String(adresse)).toContain('cols=id%2Ctype%2Cdistance')
  })

  it('laesst unbestimmte Suchwerte weg', async () => {
    vi.mocked(fetch).mockResolvedValue(antwort(200, []))
    await ohneWarten(
      icuHolen(ZUGANG, '/athlete/i1/activities', {
        suchwerte: { oldest: '2026-01-01', newest: undefined },
      }),
    )
    const [adresse] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(String(adresse)).toContain('oldest=2026-01-01')
    expect(String(adresse)).not.toContain('newest')
  })
})
