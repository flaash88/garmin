/**
 * Hält die Antwort von intervals.icu neben das, was Takt daraus macht.
 *
 *     pnpm zonen-probe
 *
 * Gedacht für genau die Frage, an der die Zonen gescheitert sind: heißt das
 * Feld `type` oder `types`, ist es eine Zeichenkette oder ein Array, und was
 * bleibt am Ende in der Tabelle stehen. Die Antwort wird dafür **roh**
 * ausgegeben, nicht zusammengefasst — eine Zusammenfassung hätte den Befund
 * gerade verdeckt.
 *
 * Schreibt nichts. Braucht ICU_API_KEY und ICU_ATHLET_ID.
 */
import { zonenHolen } from '@/lib/icu/endpunkte'
import { zugangAusUmgebung } from '@/lib/icu/klient'
import { zonenUmwandeln } from '@/lib/abgleich/umwandeln'
import { istLeerbefund, leerbefund } from '@/lib/abgleich/leerbefund'
import { PFLICHTFELDER } from '@/lib/abgleich/lauf'
import { pace } from '@/lib/format'

let zugang
try {
  zugang = zugangAusUmgebung()
} catch (fehler) {
  // Ein Stapelauszug sagt hier nichts, was der Satz nicht sagt.
  console.error(fehler instanceof Error ? fehler.message : 'Zugang fehlt.')
  process.exit(1)
}

let roh
try {
  roh = await zonenHolen(zugang)
} catch (fehler) {
  console.error(
    'Die Abfrage ist gescheitert: ' +
      (fehler instanceof Error ? fehler.message : 'unbekannter Fehler'),
  )
  process.exit(1)
}

console.log(`Antwort: ${roh.length} Sätze\n`)

for (const [i, satz] of roh.entries()) {
  const felder = satz && typeof satz === 'object' ? Object.keys(satz) : []
  console.log(`Satz ${i + 1}: ${felder.join(', ')}`)
}

console.log('\nRoh, ungekürzt:\n')
console.log(JSON.stringify(roh, null, 2))

const zeilen = roh.flatMap(zonenUmwandeln)

console.log(`\nDaraus würden ${zeilen.length} Zeilen in «zonen»:\n`)
for (const z of zeilen) {
  const stuecke = [
    `Schwellenpuls ${z.schwellenPuls ?? '–'}`,
    `Maximalpuls ${z.maxPuls ?? '–'}`,
    `Grenzen ${z.pulsGrenzen?.join('/') ?? '–'}`,
    `Schwellenpace ${
      z.schwellenPaceSekundenJeKm === null ? '–' : pace(z.schwellenPaceSekundenJeKm)
    } (aus ${z.schwellenPaceMeterJeSekunde ?? '–'} m/s)`,
  ]
  console.log(`  ${z.sportart.padEnd(16)} ${stuecke.join(' · ')}`)
}

if (istLeerbefund(roh.length, zeilen.length)) {
  console.log('\n' + leerbefund('Zonen', roh, PFLICHTFELDER['zonen'] ?? []))
  process.exit(2)
}

/*
 * Die Umrechnung der Schwellenpace ist die eine Stelle, an der gerechnet und
 * nicht nur übernommen wird. Sie steht deshalb hier zur Prüfung.
 */
const mitPace = zeilen.filter((z) => z.schwellenPaceMeterJeSekunde !== null)
if (mitPace.length > 0) {
  console.log(
    '\nPrüf die Schwellenpace: intervals.icu liefert eine Geschwindigkeit in m/s, ' +
      'Takt rechnet sie in Sekunden je Kilometer um. Steht oben etwas, das nicht ' +
      'zu deinen Werten passt, stimmt die Annahme nicht.',
  )
}
