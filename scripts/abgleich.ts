/**
 * Ein Durchlauf des Abgleichs. Rückfall für den Fall, dass der Webhook
 * ausbleibt — stündlich aus dem Zeitplan aufgerufen.
 *
 *     pnpm abgleich
 *
 * Der Ausgang steht in der ersten Zeile, nicht als Fußnote unter den Zahlen.
 *
 * Rückgabewerte: 0 sauber, 1 mit Fehlern, 2 ohne Ergebnis — ein Schritt hat
 * Daten geholt und nichts gespeichert. Der dritte Wert ist der Grund für
 * diese Änderung: ein solcher Lauf hat sich dreimal als Erfolg gemeldet,
 * zuletzt bei den Zonen. Ein Zeitplan, der nur auf 0 sieht, hätte es nie
 * bemerkt.
 */
import { abgleichLaufen, fortschrittZeilen } from '@/lib/abgleich/lauf'

const fortschritt = await abgleichLaufen()

const auffaellig = fortschritt.fehler.length > 0 || fortschritt.warnungen.length > 0

for (const zeile of fortschrittZeilen(fortschritt)) {
  if (auffaellig) console.error(zeile)
  else console.log(zeile)
}

if (fortschritt.fehler.length > 0) process.exit(1)
if (fortschritt.warnungen.length > 0) process.exit(2)
