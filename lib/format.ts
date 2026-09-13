/**
 * Formatierung für die gesamte Oberfläche: Dezimalkomma, Pace als 5:25/km,
 * Datum TT.MM.JJJJ, 24-Stunden-Zeit, metrisch. Keine englische Zeichenkette.
 */

const ZAHL = new Intl.NumberFormat('de-DE')

export function zahl(wert: number, nachkommastellen = 0): string {
  if (!Number.isFinite(wert)) return '–'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen,
  }).format(wert)
}

/** Strecke in Metern → «218,4 km» bzw. «850 m» unterhalb eines Kilometers. */
export function strecke(meter: number): string {
  if (!Number.isFinite(meter) || meter < 0) return '–'
  // Erst runden, dann die Grenze prüfen. Andersherum käme bei 999,6 m das
  // widersinnige «1.000 m» heraus statt «1,0 km».
  const ganz = Math.round(meter)
  if (ganz < 1000) return `${ZAHL.format(ganz)} m`
  return `${zahl(ganz / 1000, 1)} km`
}

/**
 * Pace als «5:25/km». Eingabe sind Sekunden je Kilometer.
 * Sekunden werden gerundet; 59,6 s wird zu einer vollen Minute.
 */
export function pace(sekundenJeKm: number): string {
  if (!Number.isFinite(sekundenJeKm) || sekundenJeKm <= 0) return '–'
  const gesamt = Math.round(sekundenJeKm)
  const minuten = Math.floor(gesamt / 60)
  const sekunden = gesamt % 60
  return `${minuten}:${String(sekunden).padStart(2, '0')}/km`
}

/** Dauer in Sekunden → «1:02:37» oder «42:11» unterhalb einer Stunde. */
export function dauer(sekunden: number): string {
  if (!Number.isFinite(sekunden) || sekunden < 0) return '–'
  const gesamt = Math.round(sekunden)
  const s = gesamt % 60
  const m = Math.floor(gesamt / 60) % 60
  const h = Math.floor(gesamt / 3600)
  const zz = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${zz(m)}:${zz(s)}` : `${m}:${zz(s)}`
}

/**
 * «2026-09-13» ohne Zeitanteil liest `new Date()` als Mitternacht UTC. Unsere
 * Ausgabe nutzt aber die örtlichen Getter, und westlich von Greenwich käme so
 * durchgehend der Vortag heraus. Solche Angaben — etwa die Spalte
 * `wellness.tag` — werden deshalb als örtliches Datum aufgebaut.
 */
const NUR_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/

function alsDatum(wert: Date | string): Date {
  if (typeof wert !== 'string') return wert
  const treffer = NUR_DATUM.exec(wert)
  if (!treffer) return new Date(wert)
  const [, jahr, monat, tag] = treffer
  return new Date(Number(jahr), Number(monat) - 1, Number(tag))
}

/** «13.09.2026» */
export function datum(wert: Date | string): string {
  const d = alsDatum(wert)
  if (Number.isNaN(d.getTime())) return '–'
  const zz = (n: number) => String(n).padStart(2, '0')
  return `${zz(d.getDate())}.${zz(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** «06:45» — immer 24 Stunden, nie AM/PM. */
export function uhrzeit(wert: Date | string): string {
  const d = alsDatum(wert)
  if (Number.isNaN(d.getTime())) return '–'
  const zz = (n: number) => String(n).padStart(2, '0')
  return `${zz(d.getHours())}:${zz(d.getMinutes())}`
}

/** «13.09.2026, 06:45» */
export function datumZeit(wert: Date | string): string {
  const d = alsDatum(wert)
  if (Number.isNaN(d.getTime())) return '–'
  return `${datum(d)}, ${uhrzeit(d)}`
}

/** Vorzeichen sichtbar machen: «+3,2», «−1,4». Echtes Minuszeichen, kein Bindestrich. */
export function mitVorzeichen(wert: number, nachkommastellen = 1): string {
  if (!Number.isFinite(wert)) return '–'
  const gerundet = Number(wert.toFixed(nachkommastellen))
  if (gerundet > 0) return `+${zahl(gerundet, nachkommastellen)}`
  if (gerundet < 0) return `−${zahl(Math.abs(gerundet), nachkommastellen)}`
  return zahl(0, nachkommastellen)
}
