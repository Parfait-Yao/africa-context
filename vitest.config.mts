import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" bloque l'import hors React Server Components : neutralisé pour les tests
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "packages/cli/tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/support/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
