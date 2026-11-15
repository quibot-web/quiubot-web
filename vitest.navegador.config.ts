import { defineConfig } from "vitest/config";
import path from "path";

// Mismo setup que vitest.config.ts, pero SOLO para *.navegador.test.ts
// (las que lanzan un Chromium real con Playwright) -- separadas del
// "npm test" de todos los días porque son mucho más lentas y variables
// que el resto de la suite (mockeada, sin red ni DB real). Corren con
// "npm run test:navegador", a mano o antes de un push, no en cada
// corrida rápida.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.navegador.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
