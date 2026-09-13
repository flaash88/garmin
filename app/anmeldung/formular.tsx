'use client'

import { useActionState } from 'react'
import { anmelden, type AnmeldeStand } from './aktionen'

const ANFANG: AnmeldeStand = { fehler: null }

export function AnmeldeFormular() {
  const [stand, absenden, laeuft] = useActionState(anmelden, ANFANG)

  return (
    <form action={absenden}>
      <label
        htmlFor="passwort"
        className="marke mb-[9px] block text-[10px] text-text-schwach"
      >
        Passwort
      </label>
      <input
        id="passwort"
        name="passwort"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="h-[46px] w-full rounded-[2px] border border-kontur-stark bg-grund px-[14px] font-mono text-[15px] tracking-[0.14em] text-text-stark outline-none focus:border-akzent"
      />
      <button
        type="submit"
        disabled={laeuft}
        className="mt-3 h-[46px] w-full cursor-pointer rounded-[2px] bg-text-stark text-[14px] font-medium text-grund disabled:cursor-wait disabled:opacity-70"
      >
        {laeuft ? 'Wird geprüft …' : 'Anmelden'}
      </button>

      {stand.fehler === null ? null : (
        <div className="mt-[11px] flex items-center gap-[9px]" role="alert">
          <span className="size-1.5 flex-none rounded-full bg-negativ" />
          <span className="text-[12.5px] text-negativ">{stand.fehler}</span>
        </div>
      )}
    </form>
  )
}
