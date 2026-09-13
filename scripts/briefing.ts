/**
 * Erzeugt das Wochenbriefing, falls es für die laufende Woche noch keines
 * gibt. Wöchentlich aus dem Zeitplan aufzurufen — nicht bei jedem
 * Seitenaufruf.
 *
 *     pnpm briefing
 */
import { briefingBeiBedarf, juengstesBriefing } from '@/lib/coach/analysen'

const erzeugt = await briefingBeiBedarf()

if (erzeugt) {
  const b = await juengstesBriefing()
  console.log(`Wochenbriefing für ${b?.bezug} erzeugt:\n`)
  console.log(b?.text ?? '')
} else {
  const b = await juengstesBriefing()
  console.log(
    `Für diese Woche liegt schon ein Briefing vor${b ? ` (${b.bezug})` : ''}. Nichts zu tun.`,
  )
}
