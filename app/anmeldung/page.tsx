import type { Metadata } from 'next'
import { AnmeldeFormular } from './formular'

export const metadata: Metadata = { title: 'Anmeldung — Takt' }

export default function AnmeldeSeite() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-grund px-4">
      {/* Gradnetz des Entwurfs. Rein gestalterisch. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden grid-cols-6 md:grid"
      >
        <div className="border-r border-kontur" />
        <div className="border-r border-kontur" />
        <div className="border-r border-kontur" />
        <div className="border-r border-kontur" />
        <div className="border-r border-kontur" />
        <div />
      </div>

      <div className="relative w-full max-w-[420px] border border-kontur bg-flaeche p-6 sm:p-10">
        <div className="text-[24px] leading-none font-semibold tracking-[0.2em] text-text-stark">
          TAKT
        </div>
        <div className="marke mt-2.5 text-[10px] leading-none tracking-[0.1em] text-text-schwach">
          Laufanalyse · selbstgehostet
        </div>

        <div className="my-7 h-px bg-kontur" />

        <AnmeldeFormular />

        <div className="mt-[22px] font-mono text-[11.5px] leading-[1.7] text-text-schwach">
          Die Sitzung bleibt 30 Tage bestehen.
        </div>
      </div>
    </main>
  )
}
