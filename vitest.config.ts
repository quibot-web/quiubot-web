import { defineConfig } from "vitest/config";
import path from "path";

// Solo la capa TypeScript (rutas, lib/metas.ts) con el cliente de
// Supabase mockeado -- NUNCA contra la base real de Supabase, ni
// staging ni producción, que la comparten. Los escenarios de
// concurrencia real (doble clic, dos pestañas) quedan documentados
// como prueba manual en docs/pruebas/metas_concurrencia.md -- ver ese
// archivo para por qué no se automatizan acá todavía.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // *.navegador.test.ts lanza un Chromium real (Playwright) -- mucho
    // más lento y variable que el resto de la suite (mockeada), y en
    // entornos restringidos puede pasarse del timeout por defecto sin
    // que haya ningún bug real. Corre aparte con "npm run test:navegador"
    // (ver package.json), nunca como parte del "npm test" de todos los días.
    exclude: ["node_modules", ".next", "**/*.navegador.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
