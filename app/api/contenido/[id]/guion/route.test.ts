// Prueba POST /api/contenido/[id]/guion con Supabase y OpenAI
// mockeados -- nunca contra la base real ni contra OpenAI de verdad.
// Cubre: solo admin, llave de OpenAI, estado válido, éxito guardando
// guion+caption+hashtags, contexto de negocio suficiente (ADN +
// info_adicional + catálogo), variedad semanal de ganchos, y que un
// guion inválido se reintenta una vez antes de rendirse.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const rateLimitMock = vi.fn((..._args: unknown[]) => true);
vi.mock("@/lib/rateLimit", () => ({ verificarLimite: (...args: unknown[]) => rateLimitMock(...args) }));

let usuarioActual: Record<string, unknown> | null = null;
let marcaActual: Record<string, unknown> | null = null;
let piezaActual: Record<string, unknown> | null = null;
let piezasAlbumActual: Record<string, unknown>[] = [];
let productosActivosActual: Record<string, unknown>[] = [];
let piezasSemanaActual: Record<string, unknown>[] = [];
let updatesRealizados: Record<string, unknown>[] = [];

function chainSimple(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }), maybeSingle: async () => ({ data, error: null }) };
  return obj;
}

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainSimple(usuarioActual);
  if (tabla === "marcas") return chainSimple(marcaActual);
  if (tabla === "productos") {
    const obj = {
      select: () => obj,
      eq: () => obj,
      order: () => obj,
      limit: () => obj,
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: productosActivosActual, error: null }),
    };
    return obj;
  }
  if (tabla === "publicaciones_organicas") {
    const obj = {
      select: () => obj,
      eq: () => obj,
      neq: () => obj,
      not: () => obj,
      maybeSingle: async () => ({ data: piezaActual }),
      update: (valores: Record<string, unknown>) => {
        updatesRealizados.push(valores);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
      // Query de variedad semanal (sin maybeSingle): se resuelve como
      // array al hacer await directo de la cadena.
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: piezasSemanaActual, error: null }),
    };
    return obj;
  }
  if (tabla === "album_creativos") {
    const obj = {
      select: () => obj,
      eq: () => obj,
      in: async () => ({ data: piezasAlbumActual, error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
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
// info_adicional real y suficiente -- la descripción REAL del negocio,
// nunca algo que la IA tenga que deducir por el nombre de la marca
// (caso real: "Quiubot" asumido como chatbot por el nombre).
const MARCA_BASE = {
  adn_marca: { titular: "Marca de prueba", frase_corta: "Hecho con cariño" },
  nombre_marca: "Marca",
  logo_url: null,
  info_adicional: "Plataforma de publicidad en Meta (Facebook e Instagram) con un equipo de IA, para pymes.",
};

const GUION_VALIDO_CRUDO = {
  gancho_tipo: "pregunta",
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
    piezaActual = { id: "pieza-1", receta_organica: "mito_verdad", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null };
    piezasAlbumActual = [];
    productosActivosActual = [];
    piezasSemanaActual = [];
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

  it("sin info_adicional real ni productos en el catálogo: 400, nunca llama a OpenAI (pide completar Mi marca)", async () => {
    marcaActual = { ...MARCA_BASE, info_adicional: null };
    productosActivosActual = [];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("Completa Mi marca");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("sin info_adicional pero con al menos un producto en el catálogo: alcanza, sí genera", async () => {
    marcaActual = { ...MARCA_BASE, info_adicional: null };
    productosActivosActual = [{ nombre: "Gestión de anuncios en Meta", tipo: "servicio", destacar: "Resultados en 30 días", precio_cop: null }];
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("éxito: genera, valida y guarda guion + caption + hashtags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.guion.uso).toBe("organico");
    expect(body.guion.receta_organica).toBe("mito_verdad");
    expect(body.guion.gancho_tipo).toBe("pregunta");
    expect(updatesRealizados[0]).toMatchObject({ caption: GUION_VALIDO_CRUDO.caption, hashtags: GUION_VALIDO_CRUDO.hashtags });
    vi.unstubAllGlobals();
  });

  it("primer intento inválido (falta la escena cta): reintenta una vez y si sigue mal, 502 con resumenErrores", async () => {
    const guionRoto = { ...GUION_VALIDO_CRUDO, escenas: GUION_VALIDO_CRUDO.escenas.slice(0, 1) };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionRoto));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 intento + 1 reintento
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "contenido_guion" }));
    expect(updatesRealizados.length).toBe(0);
    expect(Array.isArray(body.resumenErrores)).toBe(true);
    expect(body.resumenErrores.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("duraciones muy lejos del objetivo: se reescalan solas y pasa al primer intento, sin gastar reintento (caso real del 14 nov 2026)", async () => {
    // Todas al mínimo (1.5s) -- suma 6s, muy lejos de los 16s por
    // defecto de mito_verdad. ajustarDuracionesProporcional debe
    // reescalarlas (respetando el tope de 2.5s del gancho) para que
    // quede dentro de +-2s sin que la IA tenga que volver a intentar.
    const guionDuracionesCortas = {
      ...GUION_VALIDO_CRUDO,
      escenas: GUION_VALIDO_CRUDO.escenas.map((e) => ({ ...e, duracion_s: 1.5 })),
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionDuracionesCortas));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const suma = body.guion.escenas.reduce((acc: number, e: { duracion_s: number }) => acc + e.duracion_s, 0);
    expect(Math.abs(suma - 16)).toBeLessThanOrEqual(2);
    expect(body.guion.escenas[0].duracion_s).toBeLessThanOrEqual(2.5); // el gancho nunca pasa su tope
    vi.unstubAllGlobals();
  });

  it("hashtags repetidos y de más: se limpian solos y pasa al primer intento", async () => {
    const guionHashtagsSucios = {
      ...GUION_VALIDO_CRUDO,
      hashtags: ["#Marketing", "marketing", "#MARKETING", "#ventas", "#tips", "#negocio", "#pyme", "#colombia", "#extra1", "#extra2"],
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionHashtagsSucios));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.guion.publicacion.hashtags).toEqual(["#Marketing", "#ventas", "#tips", "#negocio", "#pyme", "#colombia", "#extra1", "#extra2"]);
    vi.unstubAllGlobals();
  });

  it("variedad semanal de ganchos: si el tipo ya se usó 2 veces esta semana, se rechaza y pide otro tipo", async () => {
    // Otras 2 piezas de la MISMA semana ya usaron "pregunta" -- la
    // tercera (esta) no puede repetirlo.
    piezasSemanaActual = [
      { id: "otra-1", guion: { gancho_tipo: "pregunta" } },
      { id: "otra-2", guion: { gancho_tipo: "pregunta" } },
    ];
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO)); // gancho_tipo: "pregunta" otra vez
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.resumenErrores.some((e: string) => e.includes("pregunta") && e.toLowerCase().includes("gancho"))).toBe(true);
    expect(updatesRealizados.length).toBe(0);
    vi.unstubAllGlobals();
  });

  it("mito_verdad: una respuesta dudosa ('no necesariamente') se rechaza -- la verdad debe ser firme", async () => {
    const guionDudoso = {
      ...GUION_VALIDO_CRUDO,
      escenas: GUION_VALIDO_CRUDO.escenas.map((e) =>
        e.id === "e2" ? { ...e, params: { ...e.params, respuesta: "No necesariamente, puede apoyar" } } : e
      ),
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionDudoso));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.resumenErrores.some((e: string) => e.includes("verdad tibia"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("copy abstracto ('una forma más clara'): se rechaza en cualquier receta orgánica", async () => {
    const guionAbstracto = {
      ...GUION_VALIDO_CRUDO,
      escenas: GUION_VALIDO_CRUDO.escenas.map((e) =>
        e.id === "e3" ? { ...e, params: { ...e.params, respuesta: "Es una forma más clara de hacerlo" } } : e
      ),
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionAbstracto));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.resumenErrores.some((e: string) => e.includes("copy abstracto"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("créditos de OpenAI agotados: mensaje claro, no el genérico (caso real del 14 nov 2026)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({ error: { message: "You have no credits remaining.", type: "insufficient_quota", code: "credit_balance_exhausted" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.error).toContain("no tiene créditos");
    vi.unstubAllGlobals();
  });

  it("con media_ids y producto_en_uso: usa producto_hero con la pieza real del álbum", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "producto_en_uso", estado: "borrador", media_ids: ["demo-1"], semana: "2026-11-09", tema: null };
    piezasAlbumActual = [{ id: "demo-1", url_imagen: "https://res.cloudinary.com/demo/image/upload/v1/foto.jpg", tipo: "imagen", analisis: { version: 1, tiene_texto: false, es_publicitaria: false, fondo_limpio: true, recuadro_producto: null } }];

    const guionConProducto = {
      gancho_tipo: "antes_despues",
      bucle: { texto: "Mira el resultado", abre_en: "e1", cierra_en: "e2", indicador: "espera_final" },
      escenas: [
        { id: "e1", bloque: "gancho", tipo: "gancho_texto", duracion_s: 2.2, params: { texto: "¿Necesitas un cambio?", palabra_clave: "cambio" } },
        { id: "e2", bloque: "producto", tipo: "producto_hero", duracion_s: 5, params: { media_id: "demo-1", nombre: "Resultado real", tratamiento: "completa" } },
        { id: "e3", bloque: "beneficio", tipo: "beneficios_lista", duracion_s: 5, params: { items: ["Hecho a tu medida", "Dura de verdad"] } },
        { id: "e4", bloque: "cta", tipo: "cta", duracion_s: 5, params: { accion: "suave", texto_boton: "Conócenos" } },
      ],
      caption: "Así quedó.",
      hashtags: ["#a", "#b", "#c"],
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionConProducto));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.guion.escenas[1].params.media_id).toBe("demo-1");
    vi.unstubAllGlobals();
  });

  it("si la IA inventa un media_id que no está entre las piezas disponibles: se rechaza", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "producto_en_uso", estado: "borrador", media_ids: ["demo-1"], semana: "2026-11-09", tema: null };
    piezasAlbumActual = [{ id: "demo-1", url_imagen: "https://res.cloudinary.com/demo/image/upload/v1/foto.jpg", tipo: "imagen", analisis: { version: 1, tiene_texto: false, es_publicitaria: false, fondo_limpio: true, recuadro_producto: null } }];

    const guionConMediaInventado = {
      gancho_tipo: "antes_despues",
      bucle: { texto: "Mira el resultado", abre_en: "e1", cierra_en: "e2", indicador: "espera_final" },
      escenas: [
        { id: "e1", bloque: "gancho", tipo: "gancho_texto", duracion_s: 2.2, params: { texto: "¿Necesitas un cambio?", palabra_clave: "cambio" } },
        { id: "e2", bloque: "producto", tipo: "producto_hero", duracion_s: 5, params: { media_id: "no-existe", nombre: "Resultado real", tratamiento: "completa" } },
        { id: "e3", bloque: "beneficio", tipo: "beneficios_lista", duracion_s: 5, params: { items: ["Hecho a tu medida", "Dura de verdad"] } },
        { id: "e4", bloque: "cta", tipo: "cta", duracion_s: 5, params: { accion: "suave", texto_boton: "Conócenos" } },
      ],
      caption: "Así quedó.",
      hashtags: ["#a", "#b", "#c"],
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionConMediaInventado));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    expect(res.status).toBe(502);
    expect(updatesRealizados.length).toBe(0);
    vi.unstubAllGlobals();
  });
});
