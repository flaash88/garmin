import { CoachStrom } from '@/komponenten/coach-strom'

export const metadata = { title: 'Coach — Takt' }

export default function Coach() {
  return (
    <div className="flex h-full min-h-[calc(100dvh-60px)] flex-col">
      <div className="flex-none border-b border-kontur px-5 py-4 md:px-6">
        <h1 className="text-[20px] font-semibold text-text-stark">Coach</h1>
        <p className="marke mt-1.5 text-[10px] text-text-schwach">
          Du, nüchtern · keine Daten verlassen den Server
        </p>
      </div>
      <CoachStrom />
    </div>
  )
}
