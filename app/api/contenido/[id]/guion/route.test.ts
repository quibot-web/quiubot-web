// Prueba POST /api/contenido/[id]/guion con Supabase y OpenAI
// mockeados -- nunca contra la base real ni contra OpenAI de verdad.
// Cubre: solo admin, llave de OpenAI, estado válido, éxito guardando
// guion+caption+hashtags, y que un guion inválido se reintenta una vez
// antes de rendirse.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const rateLimitMock = vi.fn((..._args: unknown[]) => true);
vi.mock("@/lib/rateLimit", () => ({ verificarLimite: (...args: unknown[]) => rateLimitMock(...args) }));

let usuarioActual: Record<string, unknown> | null = null;
let marcaActual: Record<string, unknown> | null = null;
let piezaActual: Record<string, unknown> | null = null;
let updatesRealizados: Record<string, unknown>[] = [];

function chainSimple(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }), maybeSingle: async () => ({ data, error: null }) };
  return obj;
}

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainSimple(usuarioActual);
  if (tabla === "marcas") return chainSimple(marcaActual);
  if (tabla === "publicaciones_organicas") {
    const obj = {
      select: () => obj,
      eq: () => obj,
      maybeSingle: async () => ({ data: piezaActual }),
      update: (valores: Record<string, unknown>) => {
        updatesRealizados.push(valores);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    };
    return obj;
  }
  throw new Error(`from("${String(tabla)}") no mockeado en este test`);
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}));

const registrarErrorMock = vi.fn();
vi.mock("@/lib/registrarError", () => ({ registrarError: (...args: unknown[]) => registrarErrorMock(...args) }));

const { POST } = await import("./route");

const USUARIO_ADMIN = { id: "user-1", rol: "admin", openai_key: "sk-test" };
const MARCA_BASE = { adn_marca: { titular: "Marca de prueba", frase_corta: "Hecho con cariño" }, nombre_marca: "Marca", logo_url: null, info_adicional: null };

const GUION_VALIDO_CRUDO = {
  bucle: { texto: "¿Ya lo sabías?", abre_en: "e1", cierra_en: "e2", indicador: "espera_final" },
  escenas: [
    { id: "e1", bloque: "gancho", tipo: "gancho_texto", duracion_s: 2.3, params: { texto: "¿Ya sabías esto?", palabra_clave: "sabías" } },
    { id: "e2", bloque: "objecion", tipo: "objecion_respuesta", duracion_s: 4.5, params: { objecion: "Objeción corta", respuesta: "Respuesta corta" } },
    { id: "e3", bloque: "objecion", tipo: "objecion_respuesta", duracion_s: 5, params: { objecion: "Otra objeción", respuesta: "Otra respuesta" } },
    { id: "e4", bloque: "cta", tipo: "cta", duracion_s: 5, params: { accion: "comentar", texto_boton: "Comenta si lo sabías", palabra_clave_comentario: "MITO" } },
  ],
  caption: "Un caption cualquiera para el reel.",
  hashtags: ["#uno", "#dos", "#tres"],
};

function respuestaOpenAI(contenidoObjeto: unknown) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(contenidoObjeto) } }] }) };
}

function req() {
  return new NextRequest("http://localhost/api/contenido/pieza-1/guion", { method: "POST" });
}
function contexto() {
  return { params: Promise.resolve({ id: "pieza-1" }) };
}

describe("POST /api/contenido/[id]/guion", () => {
  beforeEach(() => {
    fromMock.mockClear();
    registrarErrorMock.mockReset();
    rateLimitMock.mockReturnValue(true);
    updatesRealizados = [];
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    marcaActual = MARCA_BASE;
    piezaActual = { id: "pieza-1", receta_organica: "mito_verdad", estado: "borrador" };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sin sesión: 401", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req(), contexto());
    expect(res.status).toBe(401);
  });

  it("usuario no admin: 403", async () => {
    usuarioActual = { ...USUARIO_ADMIN, rol: "cliente" };
    const res = await POST(req(), contexto());
    expect(res.status).toBe(403);
  });

  it("sin llave de OpenAI: 400", async () => {
    usuarioActual = { ...USUARIO_ADMIN, openai_key: null };
    const res = await POST(req(), contexto());
    expect(res.status).toBe(400);
  });

  it("pieza que no está en borrador: 400", async () => {
    piezaActual = { ...piezaActual, estado: "aprobada" };
    const res = await POST(req(), contexto());
    expect(res.status).toBe(400);
  });

  it("sin ADN de marca: 400", async () => {
    marcaActual = null;
    const res = await POST(req(), contexto());
    expect(res.status).toBe(400);
  });

  it("éxito: genera, valida y guarda guion + caption + hashtags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.guion.uso).toBe("organico");
    expect(body.guion.receta_organica).toBe("mito_verdad");
    expect(updatesRealizados[0]).toMatchObject({ caption: GUION_VALIDO_CRUDO.caption, hashtags: GUION_VALIDO_CRUDO.hashtags });
    vi.unstubAllGlobals();
  });

  it("primer intento inválido (falta la escena cta): reintenta una vez y si sigue mal, 502", async () => {
    const guionRoto = { ...GUION_VALIDO_CRUDO, escenas: GUION_VALIDO_CRUDO.escenas.slice(0, 1) };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionRoto));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 intento + 1 reintento
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "contenido_guion" }));
    expect(updatesRealizados.length).toBe(0);
    vi.unstubAllGlobals();
  });
});
