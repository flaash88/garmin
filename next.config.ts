import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  /*
   * Eigenständiges Bündel: Next legt unter .next/standalone einen Server ab,
   * der nur die wirklich benutzten Teile von node_modules mitbringt. Das
   * Abbild wird damit ein Vielfaches kleiner, und im Betrieb liegt kein
   * vollständiges node_modules herum.
   */
  output: 'standalone',

  /*
   * Die native Binärdatei des Agent SDK von Hand in das Bündel nehmen.
   *
   * Das SDK liefert sie als **optionale** Abhängigkeit je Plattform
   * (@anthropic-ai/claude-agent-sdk-linux-x64 und Geschwister) und sucht sie
   * zur Laufzeit über einen zusammengesetzten Pfad. Die Ablaufverfolgung von
   * Next sieht nur statische Verweise und lässt sie deshalb aus — der Build
   * läuft durch, und erst der erste Chat scheitert mit
   *
   *     Native CLI binary for linux-x64 not found.
   *
   * Nachgewiesen: ohne diese Zeilen findet `find .next/standalone -name claude`
   * nichts. Siehe DECISIONS.md, E8.1.
   *
   * Das Muster greift, was immer installiert ist — pnpm holt nur das Paket
   * der laufenden Plattform, in einem Alpine-Abbild also die musl-Fassung.
   */
  outputFileTracingIncludes: {
    '/api/coach': ['./node_modules/.pnpm/@anthropic-ai+claude-agent-sdk-*/**'],
  },
}

export default config
