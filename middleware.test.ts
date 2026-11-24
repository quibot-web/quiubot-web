import { describe, expect, it, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: (fn: unknown) => fn }));
vi.mock("@/lib/adminCandado", () => ({ NOMBRE_COOKIE_ADMIN: "x", verificarCandadoAdmin: async () => true }));
const { default: middleware, esPaginaLegalPublica } = await import("./middleware");

// Meta revisa estas páginas sin sesión (revisión de la app, Acceso Avanzado).
describe("páginas legales públicas para la revisión de Meta", () => {
  it("privacidad, términos y eliminación de datos se abren sin sesión; el resto de la app pide login", async () => {
    const pedir = async (ruta: string) => {
      const url = `https://quiubot.site${ruta}`;
      const req = { auth: null, url, nextUrl: new URL(url), cookies: { get: () => undefined }, headers: new Headers({ host: "quiubot.site" }) };
      const res = (await (middleware as unknown as (r: unknown) => Promise<Response | undefined>)(req)) as Response | undefined;
      return res?.headers.get("location") ?? "pasa";
    };
    for (const ruta of ["/privacidad", "/terminos", "/eliminar-datos"]) {
      expect(esPaginaLegalPublica(ruta)).toBe(true);
      expect(await pedir(ruta), ruta).toBe("pasa");
    }
    expect(await pedir("/contenido")).toMatch(/\/login/);
  });
});
