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
}

export default config
