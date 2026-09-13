import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Spielt die Messages-API für Tests.
 *
 * Warum das nötig ist: die Schranken des Coach hängen am **Agentenpfad** —
 * daran, was die Laufzeit mit einem Werkzeugaufruf macht. Ein Test, der
 * `canUseTool` unmittelbar aufruft, prüft die Funktion, nicht den Pfad, und
 * übersieht genau die Fälle, in denen der Rückruf gar nicht erst gefragt wird
 * (siehe DECISIONS.md, E9.1). Deshalb läuft der echte Agent, und nur das
 * Modell dahinter ist nachgebaut.
 *
 * Der Server antwortet nach Drehbuch — aber nur auf die eigentliche
 * Agentenanfrage, erkennbar an den Takt-Werkzeugen im Angebot. Titelerzeugung
 * und Statusabfragen bekommen eine belanglose Antwort, sonst verbrauchen sie
 * die Schritte.
 */

export type Schritt =
  | { art: 'text'; text: string }
  | { art: 'werkzeug'; name: string; eingabe?: Record<string, unknown> }

export interface Mitschrift {
  /** Werkzeuge, die dem Modell in der Agentenanfrage angeboten wurden. */
  angeboteneWerkzeuge: string[]
}

export interface FalscheApi {
  adresse: string
  mitschrift: Mitschrift
  schliessen: () => Promise<void>
}

function bloecke(schritt: Schritt, runde: number): unknown[] {
  if (schritt.art === 'werkzeug') {
    return [
      {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: `tu_${runde}`,
          name: schritt.name,
          input: {},
        },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'input_json_delta',
          partial_json: JSON.stringify(schritt.eingabe ?? {}),
        },
      },
      { type: 'content_block_stop', index: 0 },
    ]
  }
  return [
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: schritt.text },
    },
    { type: 'content_block_stop', index: 0 },
  ]
}

export async function falscheApiStarten(drehbuch: Schritt[]): Promise<FalscheApi> {
  const mitschrift: Mitschrift = { angeboteneWerkzeuge: [] }
  let runde = 0

  const server: Server = createServer((anfrage, antwort) => {
    let koerper = ''
    anfrage.on('data', (teil) => (koerper += teil))
    anfrage.on('end', () => {
      let gelesen: { tools?: Array<{ name?: string; type?: string }> } | null = null
      try {
        gelesen = JSON.parse(koerper)
      } catch {
        gelesen = null
      }

      const werkzeuge = (gelesen?.tools ?? []).map((w) => String(w.name ?? w.type ?? ''))
      const istAgent = werkzeuge.some((w) => w.startsWith('mcp__takt__'))
      if (istAgent && mitschrift.angeboteneWerkzeuge.length === 0) {
        mitschrift.angeboteneWerkzeuge = werkzeuge
      }

      if (!anfrage.url?.includes('/v1/messages')) {
        antwort.writeHead(404).end('{}')
        return
      }

      const schritt: Schritt = istAgent
        ? (drehbuch[Math.min(runde, drehbuch.length - 1)] ?? { art: 'text', text: 'fertig' })
        : { art: 'text', text: 'ok' }
      if (istAgent) runde += 1

      antwort.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      })
      const ereignisse = [
        {
          type: 'message_start',
          message: {
            id: `msg_${runde}`,
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-5',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
        ...bloecke(schritt, runde),
        {
          type: 'message_delta',
          delta: {
            stop_reason: schritt.art === 'werkzeug' ? 'tool_use' : 'end_turn',
            stop_sequence: null,
          },
          usage: { output_tokens: 5 },
        },
        { type: 'message_stop' },
      ]
      for (const e of ereignisse) {
        antwort.write(`event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
      }
      antwort.end()
    })
  })

  await new Promise<void>((fertig) => server.listen(0, '127.0.0.1', fertig))
  const port = (server.address() as AddressInfo).port

  return {
    adresse: `http://127.0.0.1:${port}`,
    mitschrift,
    schliessen: () =>
      new Promise<void>((fertig) => {
        server.closeAllConnections?.()
        server.close(() => fertig())
      }),
  }
}
