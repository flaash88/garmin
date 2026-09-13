import { hash } from '@node-rs/argon2'
import { afterEach, describe, expect, it } from 'vitest'
import { passwortStimmt } from './passwort'

const PASSWORT = 'ein-sehr-langes-testpasswort'

/** Dieselben Werte wie in scripts/hash.ts. */
async function hashErzeugen(wert: string): Promise<string> {
  return hash(wert, { algorithm: 2, memoryCost: 19_456, timeCost: 3, parallelism: 1 })
}

afterEach(() => {
  delete process.env['TAKT_PASSWORT_HASH']
})

describe('passwortStimmt', () => {
  it('erzeugt wirklich argon2id, nicht argon2i oder argon2d', async () => {
    const h = await hashErzeugen(PASSWORT)
    expect(h.startsWith('$argon2id$')).toBe(true)
  })

  it('nimmt das richtige Passwort an', async () => {
    process.env['TAKT_PASSWORT_HASH'] = await hashErzeugen(PASSWORT)
    expect(await passwortStimmt(PASSWORT)).toBe(true)
  })

  it('weist ein falsches Passwort ab', async () => {
    process.env['TAKT_PASSWORT_HASH'] = await hashErzeugen(PASSWORT)
    expect(await passwortStimmt('falsch')).toBe(false)
    expect(await passwortStimmt('')).toBe(false)
    expect(await passwortStimmt(PASSWORT + ' ')).toBe(false)
  })

  it('weist ab statt zu werfen, wenn der Hash unlesbar ist', async () => {
    process.env['TAKT_PASSWORT_HASH'] = 'kein gueltiger Hash'
    expect(await passwortStimmt(PASSWORT)).toBe(false)
  })

  it('wirft, wenn der Hash gar nicht gesetzt ist', async () => {
    await expect(passwortStimmt(PASSWORT)).rejects.toThrow('TAKT_PASSWORT_HASH')
  })
})
