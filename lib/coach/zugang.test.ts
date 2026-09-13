import { describe, expect, it } from 'vitest'
import {
  istZugangsfehler,
  startmeldung,
  TOKEN_PRAEFIX,
  ZugangAbgelaufen,
  zugangPruefen,
} from './zugang'

const GUELTIG = TOKEN_PRAEFIX + 'x'.repeat(60)

describe('zugangPruefen', () => {
  it('nimmt einen Token mit dem richtigen Praefix', () => {
    expect(zugangPruefen(GUELTIG)).toEqual({ art: 'da', token: GUELTIG })
  })

  it('meldet einen fehlenden Token', () => {
    expect(zugangPruefen(undefined).art).toBe('fehlt')
    expect(zugangPruefen('').art).toBe('fehlt')
    expect(zugangPruefen('   ').art).toBe('fehlt')
  })

  it('weist einen API-Schluessel ab, statt ihn durchzulassen', () => {
    // Der haeufigste Vertipper. Er wuerde sogar funktionieren — nur ueber
    // das falsche Konto abgerechnet.
    const e = zugangPruefen('sk-ant-api03-' + 'y'.repeat(60))
    expect(e.art).toBe('unbrauchbar')
    expect(e.art === 'unbrauchbar' && e.grund).toContain('sk-ant-oat01-')
  })

  it('nennt im Grund nur den Anfang, nie den ganzen Wert', () => {
    const geheim = 'sk-ant-api03-' + 'z'.repeat(60)
    const e = zugangPruefen(geheim)
    expect(e.art === 'unbrauchbar' && e.grund).not.toContain('z'.repeat(20))
  })

  it('weist einen zu kurzen Token ab', () => {
    expect(zugangPruefen(TOKEN_PRAEFIX + 'kurz').art).toBe('unbrauchbar')
  })

  it('laesst fuehrende und nachlaufende Leerzeichen durchgehen', () => {
    expect(zugangPruefen(`  ${GUELTIG}  `)).toEqual({ art: 'da', token: GUELTIG })
  })
})

describe('istZugangsfehler', () => {
  it('erkennt die ueblichen Meldungen', () => {
    for (const t of [
      'Request failed with status 401',
      'HTTP 403 Forbidden',
      'Unauthorized',
      'authentication_error: invalid x-api-key',
      'OAuth token has expired',
      'Your credentials have expired, please run claude login',
      'invalid api key',
    ]) {
      expect(istZugangsfehler(new Error(t)), t).toBe(true)
    }
  })

  it('erkennt den eigenen Fehlertyp', () => {
    expect(istZugangsfehler(new ZugangAbgelaufen())).toBe(true)
  })

  it('haelt andere Fehler auseinander', () => {
    for (const t of [
      'ECONNREFUSED 127.0.0.1:5432',
      'Der Coach kam nach acht Zuegen zu keiner Antwort.',
      'relation "aktivitaeten" does not exist',
      'statement timeout',
      'Request failed with status 500',
    ]) {
      expect(istZugangsfehler(new Error(t)), t).toBe(false)
    }
  })

  it('haelt Leeres und Unbekanntes aus', () => {
    expect(istZugangsfehler(null)).toBe(false)
    expect(istZugangsfehler(undefined)).toBe(false)
    expect(istZugangsfehler(new Error(''))).toBe(false)
    expect(istZugangsfehler({ seltsam: true })).toBe(false)
  })
})

describe('startmeldung', () => {
  it('schweigt, wenn der Token stimmt', () => {
    expect(startmeldung({ art: 'da', token: GUELTIG })).toBeNull()
  })

  it('nennt den Befehl, wenn der Token fehlt', () => {
    const m = startmeldung({ art: 'fehlt' })
    expect(m).toContain('claude setup-token')
    expect(m).toContain('CLAUDE_CODE_OAUTH_TOKEN')
  })

  it('sagt, dass alles andere trotzdem laeuft', () => {
    expect(startmeldung({ art: 'fehlt' })).toContain('alles andere läuft')
  })
})
