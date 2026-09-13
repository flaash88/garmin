import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Derselbe Alias wie in tsconfig.json. Ohne ihn scheitert jeder Test,
      // dessen Prüfling '@/…' einführt.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    /*
     * Testdateien laufen nacheinander, nicht nebenläufig.
     *
     * Mehrere Dateien sprechen dieselbe PostgreSQL-Instanz an. Nebenläufig
     * sahen sie gegenseitig ihre Probezeilen, und welche Datei gewann, hing
     * an der Laufzeit — unter UTC ging es gut, unter America/New_York nicht.
     * Der Preis ist gering: die Reihe läuft in wenigen Sekunden.
     */
    fileParallelism: false,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', 'design/**', 'werkzeug/**', '.next/**'],
  },
})
