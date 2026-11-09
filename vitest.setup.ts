import { vi } from "vitest";

// "server-only" no es un paquete real en node_modules -- Next.js lo
// resuelve con un truco especial de su propio bundler (webpack/
// Turbopack). Fuera de ese bundler (acá, corriendo bajo Vite/vitest)
// cualquier archivo que lo importe (lib/supabase.ts, metaErrors.ts,
// etc., aunque sea transitivamente) rompería el test con "Cannot find
// module" si no se mockea acá, una sola vez, para todos los tests.
vi.mock("server-only", () => ({}));
