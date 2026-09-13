import { CoachAnsicht } from '@/komponenten/coach-ansicht'
import { unterhaltungenListe } from '@/lib/daten/unterhaltungen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Coach — Takt' }

export default async function Coach() {
  const faeden = await unterhaltungenListe()

  return (
    <div className="flex h-full min-h-[calc(100dvh-60px)] flex-col">
      <div className="flex-none border-b border-kontur px-5 py-4 md:px-6">
        <h1 className="text-[20px] font-semibold text-text-stark">Coach</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          Du, nüchtern · läuft über dein Claude-Abo
        </p>
      </div>
      <CoachAnsicht
        anfangsliste={faeden.map((u) => ({
          id: u.id,
          titel: u.titel,
          zuletztAm: u.zuletztAm.toISOString(),
        }))}
      />
    </div>
  )
}
