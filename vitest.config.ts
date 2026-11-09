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
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
