/**
 * Läuft einmal beim Hochfahren des Serverprozesses.
 *
 * Zweck: sagen, was fehlt, solange jemand hinsieht. Ein fehlender
 * Coach-Zugang fiel sonst erst auf, wenn jemand den Coach zum ersten Mal
 * anspricht — womöglich Tage später.
 */
export async function register(): Promise<void> {
  // Nur im Serverprozess, nicht in der Edge-Laufzeit.
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return

  const { startmeldung } = await import('@/lib/coach/zugang')
  const meldung = startmeldung()

  if (meldung) {
    console.warn(`[takt] ${meldung}`)
  } else {
    console.log('[takt] Coach-Zugang liegt vor.')
  }

  /*
   * Die native Binärdatei des Agent SDK. Sie fehlte nach dem ersten Bau des
   * Abbilds, und der Fehler zeigte sich erst beim ersten Chat — deshalb wird
   * sie jetzt beim Hochfahren gesucht.
   */
  const { binaerdateiStartmeldung, binaerdateiSuchen } = await import(
    '@/lib/coach/binaerdatei'
  )
  const binaer = binaerdateiSuchen()
  const binaerMeldung = binaerdateiStartmeldung(binaer)
  if (binaerMeldung) {
    console.warn(`[takt] ${binaerMeldung}`)
  } else {
    console.log(`[takt] Agent-Binärdatei gefunden (${binaer?.quelle}).`)
  }

  /*
   * Die Rolle des Coach. Ohne sie scheitert sql_abfrage — im Betrieb fiel
   * das erst im Chat auf, weil die Rolle nie angelegt worden war.
   */
  const { coachRolleStartmeldung } = await import('@/lib/coach/sql-ausfuehren')
  try {
    const rolle = await coachRolleStartmeldung()
    if (rolle) console.warn(`[takt] ${rolle}`)
    else console.log('[takt] Coach-Rolle takt_coach: Verbindung steht.')
  } catch (fehler) {
    console.warn('[takt] Coach-Rolle nicht prüfbar:', fehler)
  }

  // Die übrigen Pflichtwerte gleich mit. Fehlt einer, steht es beim Start da
  // und nicht in einem Fehler mitten im Betrieb.
  const pflicht = ['TAKT_DATENBANK_URL', 'TAKT_SITZUNG_SECRET', 'TAKT_PASSWORT_HASH']
  const fehlend = pflicht.filter((n) => !process.env[n])
  if (fehlend.length > 0) {
    console.error(
      `[takt] Diese Werte fehlen und werden gebraucht: ${fehlend.join(', ')}. ` +
        'Siehe .env.beispiel.',
    )
  }
}
