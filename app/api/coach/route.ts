import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Platzhalter bis Phase 5. Der Antwortstrom in der Oberfläche steht schon;
 * hier fehlt noch das Agent SDK.
 */
export function POST() {
  if (!process.env['ANTHROPIC_API_KEY']) {
    return NextResponse.json(
      { fehler: 'Der Coach ist nicht eingerichtet. ANTHROPIC_API_KEY fehlt.' },
      { status: 503 },
    )
  }
  return NextResponse.json(
    { fehler: 'Der Coach kommt in Phase 5.' },
    { status: 503 },
  )
}
