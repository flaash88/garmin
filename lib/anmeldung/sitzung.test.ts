import { describe, expect, it } from 'vitest'
import {
  SITZUNG_SEKUNDEN,
  sitzungErzeugen,
  sitzungPruefen,
} from './sitzung'

const GEHEIM = 'ein-hinreichend-langes-geheimnis-fuer-den-test'
const JETZT = Date.UTC(2026, 8, 13, 12, 0, 0)

describe('sitzungErzeugen und sitzungPruefen', () => {
  it('erkennt die eigene Sitzung wieder', async () => {
    const wert = await sitzungErzeugen(GEHEIM, JETZT)
    const sitzung = await sitzungPruefen(wert, GEHEIM, JETZT)
    expect(sitzung).not.toBeNull()
  })

  it('setzt den Ablauf auf 30 Tage', async () => {
    const wert = await sitzungErzeugen(GEHEIM, JETZT)
    const sitzung = await sitzungPruefen(wert, GEHEIM, JETZT)
    expect(sitzung?.laeuftAb).toBe(Math.floor(JETZT / 1000) + SITZUNG_SEKUNDEN)
  })

  it('gilt kurz vor dem Ablauf noch', async () => {
    const wert = await sitzungErzeugen(GEHEIM, JETZT)
    const knapp = JETZT + SITZUNG_SEKUNDEN * 1000 - 1000
    expect(await sitzungPruefen(wert, GEHEIM, knapp)).not.toBeNull()
  })

  it('gilt nach dem Ablauf nicht mehr', async () => {
    const wert = await sitzungErzeugen(GEHEIM, JETZT)
    const danach = JETZT + SITZUNG_SEKUNDEN * 1000 + 1000
    expect(await sitzungPruefen(wert, GEHEIM, danach)).toBeNull()
  })

  it('weist ein anderes Geheimnis ab', async () => {
    const wert = await sitzungErzeugen(GEHEIM, JETZT)
    expect(await sitzungPruefen(wert, GEHEIM + 'x', JETZT)).toBeNull()
  })

  it('weist eine veraenderte Nutzlast ab', async () => {
    const wert = await sitzungErzeugen(GEHEIM, JETZT)
    const [, signatur] = wert.split('.')
    // Ablauf weit in die Zukunft schieben und die alte Signatur anhaengen.
    const gefaelscht = Buffer.from(
      JSON.stringify({ laeuftAb: 99_999_999_999 }),
    ).toString('base64url')
    expect(await sitzungPruefen(`${gefaelscht}.${signatur}`, GEHEIM, JETZT)).toBeNull()
  })

  it('weist eine veraenderte Signatur ab', async () => {
    const wert = await sitzungErzeugen(GEHEIM, JETZT)
    const [koerper] = wert.split('.')
    expect(await sitzungPruefen(`${koerper}.AAAA`, GEHEIM, JETZT)).toBeNull()
  })

  it('weist Unsinn ab, ohne zu werfen', async () => {
    for (const wert of [undefined, '', 'ohnepunkt', 'a.b.c', '.', 'a.']) {
      expect(await sitzungPruefen(wert, GEHEIM, JETZT)).toBeNull()
    }
  })
})
