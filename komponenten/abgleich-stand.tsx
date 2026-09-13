import { letzterAbgleich } from '@/lib/daten/abgleich'
import { datumZeit } from '@/lib/format'

/**
 * Der Punkt vor dem Text trägt die Aussage: grün heißt durchgelaufen,
 * rot heißt der letzte Versuch scheiterte, grau heißt noch nie gelaufen.
 */
export async function AbgleichStand() {
  const stand = await letzterAbgleich()

  const farbe =
    stand === null ? 'bg-text-schwach' : stand.fehler ? 'bg-negativ' : 'bg-positiv'

  const text =
    stand === null
      ? 'Noch kein Abgleich'
      : stand.fehler
        ? 'Abgleich fehlgeschlagen'
        : `Abgleich ${datumZeit(stand.zuletztAm)}`

  return (
    <div
      className="inline-flex items-center gap-[7px] rounded-[2px] border border-kontur px-2.5 py-1.5 font-mono text-[11.5px] text-text-leise"
      title={stand?.fehler ?? undefined}
    >
      <span className={`size-1.5 flex-none rounded-full ${farbe}`} />
      {text}
    </div>
  )
}
