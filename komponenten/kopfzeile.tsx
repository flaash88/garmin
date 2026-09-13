import { ThemaUmschalter } from './thema-umschalter'
import { Suche } from './suche'
import { AbgleichStand } from './abgleich-stand'

/**
 * Kopfzeile am Schreibtisch, 60 px, wie im Entwurf. Am Telefon trägt jede
 * Seite ihren eigenen Kopf; die Leiste hier wäre dort zu voll.
 */
export function Kopfzeile() {
  return (
    <header className="flex h-[60px] flex-none items-center gap-4 border-b border-kontur bg-flaeche px-6">
      <Suche />
      <div className="ml-auto flex items-center gap-2.5">
        <AbgleichStand />
        <ThemaUmschalter />
      </div>
    </header>
  )
}
