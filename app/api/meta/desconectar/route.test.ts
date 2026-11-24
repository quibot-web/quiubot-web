// POST /api/meta/desconectar con Supabase simulado -- nunca contra la base real.
import { beforeEach, describe, expect, it, vi } from "vitest";

const sesion = vi.fn();
vi.mock("@/auth", () => ({ auth: () => sesion() }));
const avisar = vi.fn();
vi.mock("@/app/lib/publicadorOrganico", () => ({ avisarPublicador: (...a: unknown[]) => avisar(...a) }));

type Fila = Record<string, unknown>;
let usuarios: Fila[];
let piezas: Fila[];
function consulta(tabla: string) {
  const filtros: ((f: Fila) => boolean)[] = [];
  let valores: Fila | null = null;
  const filas = () => (tabla === "usuarios" ? usuarios : piezas).filter((f) => filtros.every((fn) => fn(f)));
  const q: Record<string, unknown> = {
    select: () => q,
    update: (v: Fila) => ((valores = v), q),
    eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
    in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[c])), q),
    single: async () => ({ data: filas()[0] ?? null }),
    then: (r: (v: unknown) => void) => {
      const f = filas();
      if (valores) f.forEach((x) => Object.assign(x, valores));
      r({ data: f, error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: (t: string) => consulta(t) } }));

const { POST } = await import("./route");

const conectado = (id: string, email: string): Fila => ({
  id,
  email,
  meta_access_token: "tok",
  meta_token_expira: "2027-01-01",
  meta_ad_account_id: "act_1",
  meta_ad_account_nombre: "Cuenta",
  meta_business_id: "b1",
  meta_user_name: "Ana",
  meta_page_id: "page1",
  meta_page_name: "Página",
  meta_pixel_id: "px1",
  meta_pixel_nombre: "Píxel",
});

beforeEach(() => {
  usuarios = [conectado("a", "a@cliente.com"), conectado("b", "b@cliente.com")];
  piezas = [
    { id: "p1", user_id: "a", plataforma: "instagram", estado: "lista" },
    { id: "p2", user_id: "a", plataforma: "instagram", estado: "publicada" },
    { id: "p3", user_id: "b", plataforma: "instagram", estado: "lista" },
  ];
  avisar.mockReset();
  sesion.mockResolvedValue({ user: { email: "a@cliente.com" } });
});

describe("POST /api/meta/desconectar", () => {
  it("borra el token y los ids de página, cuenta publicitaria y píxel SOLO de quien lo pide; avisa que sus reels programados quedan en pausa", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, enPausa: 1 });
    const a = usuarios.find((u) => u.id === "a")!;
    for (const campo of ["meta_access_token", "meta_token_expira", "meta_ad_account_id", "meta_business_id", "meta_user_name", "meta_page_id", "meta_page_name", "meta_pixel_id"]) expect(a[campo], campo).toBeNull();
    expect(usuarios.find((u) => u.id === "b")!.meta_access_token).toBe("tok");
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(avisar.mock.calls[0][0]).toMatchObject({ userId: "a", sufijo: "sin_meta" });
    // Los reels no se tocan: el publicador los salta mientras no haya Meta.
    expect(piezas.find((p) => p.id === "p1")!.estado).toBe("lista");
  });

  it("sin reels programados: desconecta sin aviso; sin sesión: 401", async () => {
    piezas = piezas.filter((p) => p.user_id !== "a" || p.estado === "publicada");
    expect(await (await POST()).json()).toEqual({ ok: true, enPausa: 0 });
    expect(avisar).not.toHaveBeenCalled();
    sesion.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
  });
});
