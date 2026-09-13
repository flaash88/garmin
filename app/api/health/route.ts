import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Ohne Anmeldung erreichbar. Verrät nichts über den Zustand der Daten. */
export function GET() {
  return NextResponse.json({ zustand: 'ok', zeit: new Date().toISOString() })
}
