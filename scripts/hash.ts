/**
 * Erzeugt den argon2id-Hash für TAKT_PASSWORT_HASH.
 *
 *     pnpm hash
 *
 * Die Eingabe wird nicht angezeigt und landet in keiner Verlaufsdatei —
 * deshalb wird gefragt statt ein Argument genommen.
 */
import { hash, type Algorithm } from '@node-rs/argon2'
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'

function frageVerdeckt(frage: string): Promise<string> {
  return new Promise((fertig, scheitern) => {
    // Die Eingabeaufforderung selbst schreiben, danach jede Ausgabe von
    // readline unterdrücken.
    //
    // Ein Filter, der nur den Text der Aufforderung durchlässt, reicht nicht:
    // beim Auffrischen — jedes Backspace, jeder Pfeiltaste — schreibt readline
    // Aufforderung **und** Zeile in einem Stück. Der Filter ließe das durch
    // und das Passwort stünde im Klartext auf dem Schirm. Deshalb wird gar
    // nichts durchgelassen.
    stdout.write(frage)

    const leser = createInterface({ input: stdin, output: stdout, terminal: true })
    ;(leser as unknown as { _writeToOutput: (s: string) => void })._writeToOutput =
      () => {}

    leser.on('SIGINT', () => {
      leser.close()
      stdout.write('\n')
      scheitern(new Error('Abgebrochen.'))
    })

    leser.question('', (antwort) => {
      leser.close()
      stdout.write('\n')
      fertig(antwort)
    })
  })
}

async function haupt(): Promise<void> {
  const erste = await frageVerdeckt('Passwort: ')
  if (erste.length < 12) {
    console.error('Zu kurz. Mindestens 12 Zeichen.')
    process.exit(1)
  }
  const zweite = await frageVerdeckt('Wiederholen: ')
  if (erste !== zweite) {
    console.error('Die beiden Eingaben stimmen nicht überein.')
    process.exit(1)
  }

  // Algorithm ist ein 'const enum'; unter isolatedModules lässt es sich nicht
  // als Wert einführen. Deshalb die Zahl, die es in der Typdatei trägt:
  // Argon2d = 0, Argon2i = 1, Argon2id = 2.
  const ARGON2ID = 2 as Algorithm

  // OWASP-Empfehlung für argon2id: 19 MiB, drei Durchgänge, ein Nebenlauf.
  const ergebnis = await hash(erste, {
    algorithm: ARGON2ID,
    memoryCost: 19_456,
    timeCost: 3,
    parallelism: 1,
  })

  stdout.write('\nZeile für .env:\n\n')
  stdout.write(`TAKT_PASSWORT_HASH='${ergebnis}'\n\n`)
}

void haupt()
