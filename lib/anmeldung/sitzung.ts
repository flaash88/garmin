/**
 * Signiertes Sitzungscookie. Bewusst ohne Bibliothek und ausschließlich über
 * die Web Crypto API — so läuft derselbe Code in der Middleware (Edge) und im
 * Serverprozess (Node). `node:crypto` ginge in der Middleware nicht.
 */

export const SITZUNG_COOKIE = 'takt_sitzung'
export const SITZUNG_TAGE = 30
export const SITZUNG_SEKUNDEN = SITZUNG_TAGE * 24 * 60 * 60

const KODIERER = new TextEncoder()

function basis64Url(bytes: Uint8Array): string {
  let roh = ''
  for (const b of bytes) roh += String.fromCharCode(b)
  return btoa(roh).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function ausBasis64Url(text: string): Uint8Array {
  const auffuellen = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4))
  const roh = atob(text.replaceAll('-', '+').replaceAll('_', '/') + auffuellen)
  const bytes = new Uint8Array(roh.length)
  for (let i = 0; i < roh.length; i += 1) bytes[i] = roh.charCodeAt(i)
  return bytes
}

async function schluessel(geheimnis: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    KODIERER.encode(geheimnis),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Vergleich in gleichbleibender Zeit, damit die Signatur nicht erratbar wird. */
function gleich(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let unterschied = 0
  for (let i = 0; i < a.length; i += 1) unterschied |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return unterschied === 0
}

export interface Sitzung {
  /** Zeitpunkt des Ablaufs in Sekunden seit der Epoche. */
  laeuftAb: number
}

export async function sitzungErzeugen(
  geheimnis: string,
  jetzt = Date.now(),
): Promise<string> {
  const nutzlast: Sitzung = {
    laeuftAb: Math.floor(jetzt / 1000) + SITZUNG_SEKUNDEN,
  }
  const koerper = basis64Url(KODIERER.encode(JSON.stringify(nutzlast)))
  const signatur = await crypto.subtle.sign(
    'HMAC',
    await schluessel(geheimnis),
    KODIERER.encode(koerper),
  )
  return `${koerper}.${basis64Url(new Uint8Array(signatur))}`
}

/**
 * Gibt die Sitzung zurück oder `null`. Ein `null` bedeutet immer dasselbe —
 * kein Cookie, verfälscht, abgelaufen. Der Grund wird nirgends nach außen
 * gegeben.
 */
export async function sitzungPruefen(
  wert: string | undefined,
  geheimnis: string,
  jetzt = Date.now(),
): Promise<Sitzung | null> {
  if (!wert) return null
  const teile = wert.split('.')
  if (teile.length !== 2) return null
  const [koerper, signatur] = teile
  if (!koerper || !signatur) return null

  const erwartet = await crypto.subtle.sign(
    'HMAC',
    await schluessel(geheimnis),
    KODIERER.encode(koerper),
  )
  let gegeben: Uint8Array
  try {
    gegeben = ausBasis64Url(signatur)
  } catch {
    return null
  }
  if (!gleich(new Uint8Array(erwartet), gegeben)) return null

  let nutzlast: unknown
  try {
    nutzlast = JSON.parse(new TextDecoder().decode(ausBasis64Url(koerper)))
  } catch {
    return null
  }
  if (
    typeof nutzlast !== 'object' ||
    nutzlast === null ||
    typeof (nutzlast as Sitzung).laeuftAb !== 'number'
  ) {
    return null
  }

  const sitzung = nutzlast as Sitzung
  if (sitzung.laeuftAb <= Math.floor(jetzt / 1000)) return null
  return sitzung
}

export const GEHEIMNIS_MINDESTLAENGE = 32

/**
 * Gibt das Geheimnis zurück oder `null`. Middleware und Server-Aktion müssen
 * dieselbe Schranke anlegen — sonst signiert die eine Seite mit einem
 * Geheimnis, das die andere ablehnt, und jede erfolgreiche Anmeldung endet
 * in einem Fehler 500.
 */
export function sitzungGeheimnisOderNull(): string | null {
  const geheimnis = process.env['TAKT_SITZUNG_SECRET']
  if (!geheimnis || geheimnis.length < GEHEIMNIS_MINDESTLAENGE) return null
  return geheimnis
}

export function sitzungGeheimnis(): string {
  const geheimnis = sitzungGeheimnisOderNull()
  if (!geheimnis) {
    throw new Error(
      `TAKT_SITZUNG_SECRET fehlt oder ist kürzer als ${GEHEIMNIS_MINDESTLAENGE} Zeichen. Siehe .env.beispiel.`,
    )
  }
  return geheimnis
}
