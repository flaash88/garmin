export const THEMEN = ['hell', 'dunkel'] as const

export type Thema = (typeof THEMEN)[number]

export const THEMA_SCHLUESSEL = 'takt.thema'

export function istThema(wert: unknown): wert is Thema {
  return typeof wert === 'string' && (THEMEN as readonly string[]).includes(wert)
}

export function gegenthema(thema: Thema): Thema {
  return thema === 'hell' ? 'dunkel' : 'hell'
}

/**
 * Läuft als Inline-Skript vor dem ersten Anstrich, damit beim Laden nichts
 * aufblitzt. Gespeicherte Wahl schlägt die Einstellung des Systems.
 */
export const THEMA_SKRIPT = `(function(){try{
var w=localStorage.getItem('${THEMA_SCHLUESSEL}');
if(w!=='hell'&&w!=='dunkel'){
  w=window.matchMedia('(prefers-color-scheme: dark)').matches?'dunkel':'hell';
}
document.documentElement.setAttribute('data-thema',w);
}catch(e){document.documentElement.setAttribute('data-thema','hell')}})()`
