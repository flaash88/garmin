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
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', 'design/**', 'werkzeug/**', '.next/**'],
  },
})
