/**
 * Wache vor `sql_abfrage`.
 *
 * Der Coach ist keine vertrauenswürdige Aufruferin. Diese Datei ist die
 * **zweite** Schranke, nicht die erste — die erste sind die fehlenden Rechte
 * der Rolle `takt_coach` (siehe datenbank/01-auswertung-schema.sql). Eine
 * Prüfung im TypeScript lässt sich denken; ein fehlendes GRANT nicht.
 *
 * Was hier trotzdem nötig ist:
 *
 *  - **Eine Anweisung je Aufruf.** Sonst käme `SELECT 1; SET statement_timeout
 *    = 0` durch — und die Rolle darf ihre eigene Zeitschranke tatsächlich
 *    aufheben, nachgewiesen in DECISIONS.md E5.2.
 *  - **Nur lesen.** Schreibende CTEs (`WITH x AS (DELETE …)`) sind syntaktisch
 *    ein SELECT. Die Leseschranke der Datenbank fängt sie ab, aber eine klare
 *    Absage ist besser als ein Datenbankfehler im Antwortstrom.
 *  - **Zeilenbegrenzung**, damit eine Abfrage nicht den halben Bestand in den
 *    Zusammenhang zieht.
 */

export const HOECHSTZEILEN = 500
export const ZEITSCHRANKE_MS = 5000

export interface WachenErgebnis {
  erlaubt: boolean
  /** Deutsche Begründung, geht an den Coach zurück. */
  grund: string | null
}

/**
 * Entfernt Kommentare und den Inhalt von Zeichenketten, behält aber die Länge
 * grob bei. Danach lässt sich nach Schlüsselwörtern und Semikola suchen, ohne
 * dass ein `--` in einem Text oder ein `;` in einem Literal etwas vortäuscht.
 *
 * Beachtet: einfache Anführung mit '' als Verdopplung, doppelte Anführung für
 * Bezeichner, Blockkommentare (in PostgreSQL schachtelbar), Zeilenkommentare
 * und Dollar-Anführung wie $$…$$ oder $tag$…$tag$.
 */
export function entkernen(sql: string): string {
  let aus = ''
  let i = 0

  while (i < sql.length) {
    const z = sql[i] as string
    const zwei = sql.slice(i, i + 2)

    // Zeilenkommentar
    if (zwei === '--') {
      const ende = sql.indexOf('\n', i)
      const bis = ende === -1 ? sql.length : ende
      aus += ' '.repeat(bis - i)
      i = bis
      continue
    }

    // Blockkommentar, schachtelbar
    if (zwei === '/*') {
      let tiefe = 1
      let j = i + 2
      while (j < sql.length && tiefe > 0) {
        if (sql.slice(j, j + 2) === '/*') {
          tiefe += 1
          j += 2
        } else if (sql.slice(j, j + 2) === '*/') {
          tiefe -= 1
          j += 2
        } else {
          j += 1
        }
      }
      aus += ' '.repeat(j - i)
      i = j
      continue
    }

    // Zeichenkette
    if (z === "'") {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      aus += "''" + ' '.repeat(Math.max(0, j - i - 2))
      i = j
      continue
    }

    // Bezeichner in doppelter Anführung
    if (z === '"') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      aus += sql.slice(i, j)
      i = j
      continue
    }

    // Dollar-Anführung: $$…$$ oder $tag$…$tag$
    if (z === '$') {
      const treffer = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i))
      if (treffer) {
        const marke = treffer[0]
        const ende = sql.indexOf(marke, i + marke.length)
        const bis = ende === -1 ? sql.length : ende + marke.length
        aus += ' '.repeat(bis - i)
        i = bis
        continue
      }
    }

    aus += z
    i += 1
  }

  return aus
}

/** Alles, was nicht lesen ist. Steht eines davon drin, wird abgewiesen. */
const VERBOTEN = [
  'insert', 'update', 'delete', 'merge', 'truncate', 'drop', 'alter', 'create',
  'grant', 'revoke', 'copy', 'call', 'do', 'vacuum', 'analyze', 'analyse',
  'reindex', 'cluster', 'refresh', 'set', 'reset', 'listen', 'notify',
  'unlisten', 'lock', 'begin', 'commit', 'rollback', 'savepoint', 'prepare',
  'execute', 'deallocate', 'declare', 'fetch', 'move', 'close', 'discard',
  'security', 'import', 'load', 'checkpoint',
]

const VERBOTEN_MUSTER = new RegExp(`\\b(${VERBOTEN.join('|')})\\b`, 'i')

/**
 * Funktionen, die über die Datenbank hinausreichen. Die Rolle darf sie ohnehin
 * nicht ausführen — nachgewiesen —, aber eine klare Absage ist besser als ein
 * Rechtefehler.
 */
const VERBOTENE_FUNKTIONEN =
  /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink|pg_sleep|pg_terminate_backend|pg_cancel_backend|set_config|current_setting)\s*\(/i

export function sqlPruefen(roh: string): WachenErgebnis {
  const sql = roh.trim()
  if (sql.length === 0) return { erlaubt: false, grund: 'Die Abfrage ist leer.' }
  if (sql.length > 4000) {
    return { erlaubt: false, grund: 'Die Abfrage ist länger als 4000 Zeichen.' }
  }

  const kern = entkernen(sql)

  // Eine Anweisung. Ein Semikola ganz am Ende ist in Ordnung.
  const ohneSchluss = kern.replace(/;\s*$/, '')
  if (ohneSchluss.includes(';')) {
    return {
      erlaubt: false,
      grund:
        'Nur eine Anweisung je Aufruf. Die Abfrage enthält mehr als ein Semikolon.',
    }
  }
  if (ohneSchluss.trim().length === 0) {
    return { erlaubt: false, grund: 'Die Abfrage enthält keine Anweisung.' }
  }

  // Beginnen darf sie mit SELECT oder WITH. Sonst gar nicht erst weiter.
  if (!/^\s*(select|with|table)\b/i.test(ohneSchluss)) {
    return {
      erlaubt: false,
      grund: 'Erlaubt sind nur SELECT, WITH und TABLE.',
    }
  }

  const verboten = VERBOTEN_MUSTER.exec(ohneSchluss)
  if (verboten) {
    return {
      erlaubt: false,
      grund: `Das Schlüsselwort ${verboten[1]?.toUpperCase()} ist nicht erlaubt. Der Coach darf ausschließlich lesen.`,
    }
  }

  const funktion = VERBOTENE_FUNKTIONEN.exec(ohneSchluss)
  if (funktion) {
    return {
      erlaubt: false,
      grund: `Die Funktion ${funktion[1]} ist nicht erlaubt.`,
    }
  }

  return { erlaubt: true, grund: null }
}
