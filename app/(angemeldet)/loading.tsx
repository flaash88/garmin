import { Laedt } from '@/komponenten/zustaende'

/** Ladezustand aus dem Entwurf, für jeden Bereich hinter der Anmeldung. */
export default function Laden() {
  return (
    <div className="space-y-5 p-5 md:p-6">
      <div className="h-7 w-40 animate-pulse bg-flaeche-2" />
      <Laedt zeilen={5} />
    </div>
  )
}
