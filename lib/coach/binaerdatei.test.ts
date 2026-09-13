import { describe, expect, it } from 'vitest'
import { binaerdateiStartmeldung, binaerdateiSuchen, plattformpakete } from './binaerdatei'

describe('plattformpakete', () => {
  it('nimmt auf musl zuerst die musl-Fassung', () => {
    expect(plattformpakete('linux', 'x64', true)).toEqual([
      '@anthropic-ai/claude-agent-sdk-linux-x64-musl',
      '@anthropic-ai/claude-agent-sdk-linux-x64',
    ])
  })

  it('nimmt auf glibc zuerst die gewoehnliche Fassung', () => {
    expect(plattformpakete('linux', 'x64', false)[0])
      .toBe('@anthropic-ai/claude-agent-sdk-linux-x64')
  })

  it('beachtet den Bogen', () => {
    expect(plattformpakete('linux', 'arm64', true)[0])
      .toBe('@anthropic-ai/claude-agent-sdk-linux-arm64-musl')
  })

  it('kennt kein musl ausserhalb von Linux', () => {
    expect(plattformpakete('darwin', 'arm64', false))
      .toEqual(['@anthropic-ai/claude-agent-sdk-darwin-arm64'])
  })
})

describe('binaerdateiSuchen', () => {
  it('findet die Binaerdatei in diesem Projekt', () => {
    // Ohne sie kann der Coach nicht starten. Faellt dieser Test um, ist die
    // optionale Abhaengigkeit nicht installiert.
    const f = binaerdateiSuchen()
    expect(f).not.toBeNull()
    expect(f?.pfad.endsWith('/claude')).toBe(true)
  })

  it('nennt, woher der Pfad stammt', () => {
    expect(['umgebung', 'aufloesung', 'paketspeicher'])
      .toContain(binaerdateiSuchen()?.quelle)
  })
})

describe('binaerdateiStartmeldung', () => {
  it('schweigt, wenn die Datei da ist', () => {
    expect(binaerdateiStartmeldung({ pfad: '/irgendwo/claude', quelle: 'umgebung' }))
      .toBeNull()
  })

  it('nennt die gesuchten Pakete und den Grund', () => {
    const m = binaerdateiStartmeldung(null)
    expect(m).toContain('claude-agent-sdk-linux')
    expect(m).toContain('--omit=optional')
    expect(m).toContain('TAKT_CLAUDE_BINAERDATEI')
  })

  it('sagt, dass alles andere weiterlaeuft', () => {
    expect(binaerdateiStartmeldung(null)).toContain('alles andere läuft')
  })
})
