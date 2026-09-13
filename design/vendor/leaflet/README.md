# Leaflet (lokal, offline)

Takt bindet Leaflet nicht über unpkg ein. Erwartet werden:

    vendor/leaflet/leaflet.js
    vendor/leaflet/leaflet.css
    vendor/leaflet/images/    (Marker- und Schatten-Grafiken)

Version 1.9.4, BSD-2-Clause — https://leafletjs.com

## Kacheln

Die Kachel-URL zeigt auf den eigenen Server:

    tiles/{z}/{x}/{y}.png

Empfohlen: vorgerenderte Kacheln für die Steiermark, Zoom 11–16,
als MBTiles hinter einem kleinen Kachel-Dienst.

## Rückfall

Ist Leaflet oder der Kachel-Dienst nicht erreichbar, zeichnet Takt die
Strecke direkt aus den GPS-Punkten als Vektorlinie über ein Gradnetz
(siehe `kartenOffline` in der Logik). Der Zustand ist gestaltet, kein Fehler.
