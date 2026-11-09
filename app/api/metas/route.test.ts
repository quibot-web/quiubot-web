// Prueba la capa TypeScript de POST /api/metas con el cliente de
// Supabase mockeado -- nunca contra la base real. Cubre: validación de
// entrada, que verificarRequisitosMeta se revisa siempre, que la RPC
// crear_meta_completa recibe los parámetros correctos, y que un choque
// con cada índice único (23514 tipo inválido, 23505 meta activa
// duplicada) se traduce al mensaje claro en vez del texto crudo de
// Postgres. La atomicidad/idempotencia REAL de la RPC (dos pestañas a
// la vez) no se puede probar con un mock -- eso queda en
// docs/pruebas/metas_concurrencia.md como prueba manual en staging.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const fromMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

const verificarRequisitosMetaMock = vi.fn();
vi.mock("@/app/lib/metas", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/app/lib/metas")>();
  return { ...real, verificarRequisitosMeta: (...args: unknown[]) => verificarRequisitosMetaMock(...args) };
});

const obtenerSaludInstagramMock = vi.fn();
vi.mock("@/app/lib/metaInstagramSalud", () => ({ obtenerSaludInstagram: (...args: unknown[]) => obtenerSaludInstagramMock(...args) }));

const registrarErrorMock = vi.fn();
vi.mock("@/lib/registrarError", () => ({ registrarError: (...args: unknown[]) => registrarErrorMock(...args) }));

const { POST } = await import("./route");

const USUARIO_BASE = {
  id: "user-1",
  rol: "admin", // admin siempre tieneAutopiloto() === true, sin depender de plan/trial
  plan: "escala",
  en_trial: false,
  trial_termina_en: null,
  fecha_vencimiento: null,
  beta_autopiloto: false,
  meta_page_id: null,
  meta_access_token: null,
  meta_pixel_id: null,
  meta_ad_account_id: null,
};

function mockUsuario(usuario: Record<string, unknown> | null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: usuario, error: null }),
      }),
    }),
  });
}

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/metas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BODY_VALIDO = {
  tipo: "leads",
  cantidad_objetivo: 50,
  fecha_fin: "2026-12-31",
  presupuesto_maximo_cop: 500000,
};

describe("POST /api/metas", () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ user: { email: "cliente@quiubot.com" } });
    fromMock.mockReset();
    rpcMock.mockReset();
    verificarRequisitosMetaMock.mockReset().mockResolvedValue({ ok: true, faltantes: [] });
    obtenerSaludInstagramMock.mockReset();
    registrarErrorMock.mockReset();
    mockUsuario(USUARIO_BASE);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rechaza sin sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req(BODY_VALIDO));
    expect(res.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rechaza un tipo de meta inválido antes de llamar a la RPC", async () => {
    const res = await POST(req({ ...BODY_VALIDO, tipo: "no_existe" }));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rechaza cantidad_objetivo <= 0", async () => {
    const res = await POST(req({ ...BODY_VALIDO, cantidad_objetivo: 0 }));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("siempre revalida verificarRequisitosMeta, nunca confía en lo que ya se validó en el chat", async () => {
    verificarRequisitosMetaMock.mockResolvedValue({
      ok: false,
      faltantes: [{ mensaje: "Necesitas conectar tu píxel de Meta." }],
    });

    const res = await POST(req(BODY_VALIDO));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("píxel");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("llama a crear_meta_completa con los parámetros correctos", async () => {
    rpcMock.mockResolvedValue({ data: { id: "meta-1", tipo: "leads" }, error: null });

    const res = await POST(req({ ...BODY_VALIDO, conversacion_id: "conv-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.meta).toEqual({ id: "meta-1", tipo: "leads" });
    expect(rpcMock).toHaveBeenCalledWith(
      "crear_meta_completa",
      expect.objectContaining({
        p_user_id: "user-1",
        p_tipo: "leads",
        p_cantidad_objetivo: 50,
        p_presupuesto_maximo_cop: 500000,
        p_costo_objetivo_cop: 10000,
        p_nivel_autonomia: "copiloto",
        p_conversacion_id: "conv-1",
      })
    );
    const llamada = rpcMock.mock.calls[0][1];
    expect(typeof llamada.p_mensaje_meta_creada).toBe("string");
    expect(typeof llamada.p_mensaje_meta_creada_otro_borrador).toBe("string");
  });

  it("manda conversacion_id null cuando no viene del cliente (ej. formulario rápido sin un borrador previo)", async () => {
    rpcMock.mockResolvedValue({ data: { id: "meta-1" }, error: null });
    await POST(req(BODY_VALIDO));
    expect(rpcMock).toHaveBeenCalledWith("crear_meta_completa", expect.objectContaining({ p_conversacion_id: null }));
  });

  it("formulario rápido con conversacion_id de un borrador del chat (aunque ese borrador nunca llegó a tener tipo): lo manda igual, para que crear_meta_completa cierre ese borrador", async () => {
    // Este es el caso real que se rompía en staging: "Prefiero llenar
    // mi meta yo mismo" se tocó muy temprano en la conversación (el
    // borrador en conversaciones_meta todavía no tenía tipo decidido),
    // y aun así el formulario debe mandar ese conversacion_id -- la RPC
    // cierra el borrador por su id, nunca necesita que tenga tipo.
    rpcMock.mockResolvedValue({ data: { id: "meta-1" }, error: null });

    await POST(req({ ...BODY_VALIDO, conversacion_id: "conv-sin-tipo-todavia" }));

    expect(rpcMock).toHaveBeenCalledWith("crear_meta_completa", expect.objectContaining({ p_conversacion_id: "conv-sin-tipo-todavia" }));
  });

  it("traduce el choque con el índice único de meta activa por tipo (23505) a un mensaje claro, 409, sin registrarError", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } });

    const res = await POST(req(BODY_VALIDO));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("Ya tienes una meta activa de este tipo.");
    expect(data.error).not.toContain("duplicate key");
    expect(registrarErrorMock).not.toHaveBeenCalled();
  });

  it("traduce el check_violation de tipo (23514) a un mensaje claro, 500, sin registrarError", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "23514", message: "violates check constraint" } });

    const res = await POST(req(BODY_VALIDO));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Ese tipo de meta no está disponible todavía.");
    expect(registrarErrorMock).not.toHaveBeenCalled();
  });

  it("cualquier otro error de la RPC (ej. la función no existe todavía) nunca muestra el texto crudo de Postgres, y lo registra con registrarError", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function public.crear_meta_completa(...) in the schema cache" } });

    const res = await POST(req(BODY_VALIDO));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("No pude crear tu meta en este momento, inténtalo de nuevo en un minuto.");
    expect(data.error).not.toContain("schema cache");
    expect(data.error).not.toContain("Postgres");
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "crear_meta", paso: "rpc_crear_meta_completa" }));
  });

  it("seguidores_instagram: token vencido corta antes de llamar a la RPC", async () => {
    obtenerSaludInstagramMock.mockResolvedValue({ tokenVencido: true, conectado: false, followers_count: null, username: null });

    const res = await POST(req({ ...BODY_VALIDO, tipo: "seguidores_instagram" }));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("seguidores_instagram: manda el valor_inicial real (followers_count de hoy)", async () => {
    obtenerSaludInstagramMock.mockResolvedValue({ tokenVencido: false, conectado: true, followers_count: 1234, username: "tienda" });
    rpcMock.mockResolvedValue({ data: { id: "meta-1" }, error: null });

    await POST(req({ ...BODY_VALIDO, tipo: "seguidores_instagram" }));

    expect(rpcMock).toHaveBeenCalledWith("crear_meta_completa", expect.objectContaining({ p_valor_inicial: 1234 }));
  });
});
