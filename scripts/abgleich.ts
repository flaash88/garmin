/**
 * Ein Durchlauf des Abgleichs. Rückfall für den Fall, dass der Webhook
 * ausbleibt — stündlich aus dem Zeitplan aufgerufen.
 *
 *     pnpm abgleich
 */
import { abgleichLaufen } from '@/lib/abgleich/lauf'

const fortschritt = await abgleichLaufen()

console.log('Abgleich fertig:')
console.log(`  Aktivitäten  ${fortschritt.aktivitaeten}`)
console.log(`  Wellness     ${fortschritt.wellness}`)
console.log(`  Plan         ${fortschritt.plan}`)
console.log(`  Ausrüstung   ${fortschritt.ausruestung}`)
console.log(`  Zonen        ${fortschritt.zonen}`)

if (fortschritt.fehler.length > 0) {
  console.error('\nFehler:')
  for (const f of fortschritt.fehler) console.error(`  ${f}`)
  process.exit(1)
}
