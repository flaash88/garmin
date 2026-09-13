/**
 * Ein Durchlauf des Abgleichs. Rückfall für den Fall, dass der Webhook
 * ausbleibt — stündlich aus dem Zeitplan aufgerufen.
 *
 *     pnpm abgleich
 *
 * Der Ausgang steht in der ersten Zeile, nicht als Fußnote unter den Zahlen.
 */
import { abgleichLaufen, fortschrittZeilen } from '@/lib/abgleich/lauf'

const fortschritt = await abgleichLaufen()

for (const zeile of fortschrittZeilen(fortschritt)) {
  if (fortschritt.fehler.length > 0) console.error(zeile)
  else console.log(zeile)
}

if (fortschritt.fehler.length > 0) process.exit(1)
