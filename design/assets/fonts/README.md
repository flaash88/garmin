# Schriften (lokal, offline)

Takt lädt keine Schriften über ein CDN. Diese fünf Dateien müssen hier liegen:

    IBMPlexSans-Regular.woff2
    IBMPlexSans-Medium.woff2
    IBMPlexSans-SemiBold.woff2
    IBMPlexMono-Regular.woff2
    IBMPlexMono-Medium.woff2

Quelle: IBM Plex, SIL Open Font License 1.1 — https://github.com/IBM/plex
Die `@font-face`-Regeln stehen im `<style>`-Block von `Takt.dc.html`
und erwarten genau diese Dateinamen relativ zu `assets/fonts/`.

Fehlen die Dateien, greift der Rückfall
`'Helvetica Neue', Helvetica, sans-serif` bzw. `'SF Mono', Menlo, monospace`.
Die Gestaltung bleibt lesbar, wirkt aber weniger technisch.
