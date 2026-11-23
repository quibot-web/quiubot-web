// Prueba POST /api/contenido/[id]/guion con Supabase y OpenAI
// mockeados -- nunca contra la base real ni contra OpenAI de verdad.
// Cubre: solo admin, llave de OpenAI, estado válido, éxito guardando
// guion+caption+hashtags, contexto de negocio suficiente (ADN +
// info_adicional + catálogo), el gancho_tipo ya asignado por el
// código (nunca elegido por la IA), y que un guion inválido se
// reintenta una vez antes de rendirse.
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
// Producto elegido para la pieza (producto_id) -- consulta con maybeSingle.
let productoPiezaActual: Record<string, unknown> | null = null;
let filtrosProductoPieza: [string, unknown][] = [];
let pistasActivasActual: Record<string, unknown>[] = [];
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
    const filtros: [string, unknown][] = [];
    const obj = {
      select: () => obj,
      eq: (c: string, v: unknown) => {
        filtros.push([c, v]);
        return obj;
      },
      order: () => obj,
      limit: () => obj,
      maybeSingle: async () => {
        filtrosProductoPieza = filtros;
        return { data: productoPiezaActual, error: null };
      },
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: productosActivosActual, error: null }),
    };
    return obj;
  }
  if (tabla === "pistas_musicales") {
    const obj = {
      select: () => obj,
      eq: () => obj,
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: pistasActivasActual, error: null }),
    };
    return obj;
  }
  if (tabla === "publicaciones_organicas") {
    const obj = {
      select: () => obj,
      eq: () => obj,
      neq: () => obj,
      not: () => obj,
      order: () => obj,
      limit: () => obj,
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

// Para probar que la receta decide el camino (pipeline con voz vs. el
// de siempre) sin reprobar el pipeline con voz por dentro -- eso ya
// tiene su propia batería en generarGuionConVoz.test.ts.
const generarGuionConVozMock = vi.fn();
vi.mock("@/app/lib/videoOrganico/generarGuionConVoz", () => ({ generarGuionConVoz: (...args: unknown[]) => generarGuionConVozMock(...args) }));

const { POST } = await import("./route");

const USUARIO_ADMIN = { id: "user-1", rol: "admin", openai_key: "sk-test", cloudinary_name: "demo", cloudinary_key: "k", cloudinary_secret: "s", meta_page_id: null, meta_access_token: null };
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
    piezaActual = { id: "pieza-1", receta_organica: "mito_verdad", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta" };
    piezasAlbumActual = [];
    productosActivosActual = [];
    piezasSemanaActual = [];
    pistasActivasActual = [{ id: "11111111-1111-4111-8111-111111111111", mood: "calida", licencia_url: "https://licencia.real/a" }];
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
    // Caso real: musica.pista_id quedaba SIEMPRE null para orgánico --
    // el reel salía publicado en silencio total.
    expect(body.guion.musica.pista_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(updatesRealizados[0]).toMatchObject({ caption: GUION_VALIDO_CRUDO.caption, hashtags: GUION_VALIDO_CRUDO.hashtags });
    vi.unstubAllGlobals();
  });

  it("sin pistas musicales activas: pista_id queda null, no rompe la generación (biblioteca vacía, no bug de código)", async () => {
    pistasActivasActual = [];
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guion.musica.pista_id).toBe(null);
    vi.unstubAllGlobals();
  });

  it("hay pistas activas pero NINGUNA con licencia (caso real: 0 de 21): pista_id queda null, nunca asigna una sin licencia", async () => {
    pistasActivasActual = [
      { id: "11111111-1111-4111-8111-111111111111", mood: "calida", licencia_url: null },
      { id: "22222222-2222-4222-8222-222222222222", mood: "confiable", licencia_url: null },
    ];
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guion.musica.pista_id).toBe(null);
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

  it("el gancho_tipo lo decide el código, no la IA -- lo que mande crudoObj.gancho_tipo se ignora", async () => {
    const guionConOtroTipo = { ...GUION_VALIDO_CRUDO, gancho_tipo: "nadie_te_dice_que" }; // la pieza tiene asignado "pregunta"
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionConOtroTipo));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guion.gancho_tipo).toBe("pregunta"); // el de la pieza, no el que mandó la IA
    vi.unstubAllGlobals();
  });

  it("pieza sin gancho_tipo asignado (de antes de este cambio): se le asigna uno y se persiste, sin bloquear la generación", async () => {
    piezaActual = { ...piezaActual, gancho_tipo: null };
    piezasSemanaActual = [{ gancho_tipo: "pregunta" }, { gancho_tipo: "pregunta" }, { gancho_tipo: "error_comun" }];
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guion.gancho_tipo).not.toBe("pregunta");
    expect(body.guion.gancho_tipo).not.toBe("error_comun");
    expect(updatesRealizados.some((u) => u.gancho_tipo === body.guion.gancho_tipo)).toBe(true);
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

  it("lista_numerada con '1/3 ' antepuesto por la IA: se limpia solo, sin gastar reintento (caso real: círculo + número duplicados)", async () => {
    // Caso real migrado a serie_partes -- consejos_numerados ya no pasa
    // por este pipeline viejo (ver describe("receta con voz...") más
    // abajo); limpiarNumeracionItemsLista() para el pipeline con voz
    // tiene su propia prueba en generarGuionConVoz.test.ts.
    piezaActual = { ...piezaActual, receta_organica: "serie_partes", gancho_tipo: "pregunta" };
    const guionConNumeracionDoble = {
      gancho_tipo: "pregunta",
      bucle: { texto: "3 trucos para tu pan", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
      escenas: [
        { id: "e1", bloque: "gancho", tipo: "gancho_texto", duracion_s: 2.3, params: { texto: "¿Tu pan se pone duro?", palabra_clave: "duro" } },
        {
          id: "e2",
          bloque: "valor",
          tipo: "lista_numerada",
          duracion_s: 5,
          params: { titulo: "3 trucos", items: ["1/3 Guárdalo en bolsa de tela", "2/3 Nunca en la nevera", "3/3 Congélalo en rebanadas"] },
        },
        {
          id: "e3",
          bloque: "valor",
          tipo: "lista_numerada",
          duracion_s: 5,
          params: { titulo: "La parte 2", items: ["Viene la parte 2", "Más trucos reales", "No te la pierdas"] },
        },
        { id: "e4", bloque: "cta", tipo: "cta", duracion_s: 4.5, params: { accion: "seguir", texto_boton: "Síguenos", usuario: "@panaderia" } },
      ],
      caption: "Trucos de pan.",
      hashtags: ["#pan", "#tips", "#cocina"],
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionConNumeracionDoble));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.guion.escenas[1].params.items).toEqual(["Guárdalo en bolsa de tela", "Nunca en la nevera", "Congélalo en rebanadas"]);
    vi.unstubAllGlobals();
  });

  it("con media_ids y producto_en_uso: usa producto_hero con la pieza real del álbum", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "producto_en_uso", estado: "borrador", media_ids: ["demo-1"], semana: "2026-11-09", tema: null, gancho_tipo: "antes_despues" };
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
    piezaActual = { id: "pieza-1", receta_organica: "producto_en_uso", estado: "borrador", media_ids: ["demo-1"], semana: "2026-11-09", tema: null, gancho_tipo: "antes_despues" };
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

describe("POST /api/contenido/[id]/guion -- receta con voz vs. receta de siempre", () => {
  beforeEach(() => {
    fromMock.mockClear();
    registrarErrorMock.mockReset();
    generarGuionConVozMock.mockReset();
    rateLimitMock.mockReturnValue(true);
    updatesRealizados = [];
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    marcaActual = { ...MARCA_BASE, voz_tts: "cedar" };
    piezasAlbumActual = [];
    productosActivosActual = [];
    piezasSemanaActual = [];
    pistasActivasActual = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("consejos_numerados: llama a generarGuionConVoz(), nunca a OpenAI directo desde esta ruta, y guarda voz_url", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "consejos_numerados", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta" };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    generarGuionConVozMock.mockResolvedValue({
      ok: true,
      guion: { version: 1, formato: "9x16", fps: 30, uso: "organico", receta_organica: "consejos_numerados", escenas: [], publicacion: { caption: "cap", hashtags: ["#a", "#b", "#c"] }, vozUrl: "https://cloudinary.test/voz.mp3" },
      puntajeAlineacion: 1,
      intentosGuion: 1,
      crudo: { palabrasPorEscenaCrudo: [], silencios: [] },
      planIlustrado: { estado: "no_aplica" },
    });

    const res = await POST(req(), contexto());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(generarGuionConVozMock).toHaveBeenCalledTimes(1);
    expect(generarGuionConVozMock.mock.calls[0][0].voz).toBe("cedar");
    // Sin REELS_ILUSTRADOS_EMAILS: ninguna cuenta pide plan ilustrado.
    expect(generarGuionConVozMock.mock.calls[0][0].conPlanIlustrado).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled(); // esta ruta ya no llama a OpenAI directo para esta receta
    expect(body.guion.vozUrl).toBe("https://cloudinary.test/voz.mp3");
    expect(updatesRealizados[0].voz_url).toBe("https://cloudinary.test/voz.mp3");
    vi.unstubAllGlobals();
  });

  it("plan ilustrado en respaldo: registra los problemas de los 3 intentos y la pieza se guarda igual con su estilo", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "consejos_numerados", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta" };
    vi.stubGlobal("fetch", vi.fn());
    generarGuionConVozMock.mockResolvedValue({
      ok: true,
      guion: { version: 1, formato: "9x16", fps: 30, uso: "organico", receta_organica: "consejos_numerados", escenas: [], publicacion: { caption: "cap", hashtags: ["#a", "#b", "#c"] }, vozUrl: "https://cloudinary.test/voz.mp3" },
      puntajeAlineacion: 1,
      intentosGuion: 1,
      crudo: { palabrasPorEscenaCrudo: [], silencios: [] },
      planIlustrado: { estado: "respaldo", errores: ["c"], historial: [["a"], ["b"], ["c"]] },
    });
    const res = await POST(req(), contexto());
    expect(res.status).toBe(200);
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ paso: "plan_ilustrado_respaldo", detalleTecnico: "intento 1: a || intento 2: b || intento 3: c" }));
    expect(updatesRealizados.at(-1)?.voz_url).toBe("https://cloudinary.test/voz.mp3");
    vi.unstubAllGlobals();
  });

  it("cuenta en REELS_ILUSTRADOS_EMAILS: pide el plan ilustrado; otra cuenta, no", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "consejos_numerados", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta" };
    vi.stubGlobal("fetch", vi.fn());
    const exito = {
      ok: true,
      guion: { version: 1, formato: "9x16", fps: 30, uso: "organico", receta_organica: "consejos_numerados", escenas: [], publicacion: { caption: "cap", hashtags: ["#a", "#b", "#c"] }, vozUrl: "https://cloudinary.test/voz.mp3" },
      puntajeAlineacion: 1,
      intentosGuion: 1,
      crudo: { palabrasPorEscenaCrudo: [], silencios: [] },
      planIlustrado: { estado: "generado", intentos: 1, ajustes: [] },
    };
    generarGuionConVozMock.mockResolvedValue(exito);
    vi.stubEnv("REELS_ILUSTRADOS_EMAILS", "otra@cuenta.com, MARCA@quiubot.com");
    await POST(req(), contexto());
    expect(generarGuionConVozMock.mock.calls[0][0].conPlanIlustrado).toBe(true);
    vi.stubEnv("REELS_ILUSTRADOS_EMAILS", "otra@cuenta.com");
    await POST(req(), contexto());
    expect(generarGuionConVozMock.mock.calls[1][0].conPlanIlustrado).toBe(false);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("consejos_numerados: el tema y el producto de la pieza (solo del propio usuario) llegan a generarGuionConVoz como eje", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "consejos_numerados", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: "fotos de producto", gancho_tipo: "pregunta", producto_id: "prod-9" };
    productoPiezaActual = { nombre: "Taza artesanal", tipo: "producto", destacar: "esmalte azul", precio_cop: 45000 };
    generarGuionConVozMock.mockResolvedValue({ ok: false, status: 502, error: "x" });

    await POST(req(), contexto());

    const entrada = generarGuionConVozMock.mock.calls[0][0].entrada;
    expect(entrada.tema).toBe("fotos de producto");
    expect(entrada.productoPieza).toEqual({ nombre: "Taza artesanal", tipo: "producto", destacar: "esmalte azul", precio_cop: 45000 });
    expect(filtrosProductoPieza).toEqual(expect.arrayContaining([["id", "prod-9"], ["user_id", USUARIO_ADMIN.id]]));
    productoPiezaActual = null;
  });

  it("consejos_numerados sin producto_id: productoPieza null, nunca consulta un producto suelto", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "consejos_numerados", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta", producto_id: null };
    filtrosProductoPieza = [];
    generarGuionConVozMock.mockResolvedValue({ ok: false, status: 502, error: "x" });

    await POST(req(), contexto());

    expect(generarGuionConVozMock.mock.calls[0][0].entrada.productoPieza).toBeNull();
    expect(filtrosProductoPieza).toEqual([]);
  });

  it("consejos_numerados sin Cloudinary conectado: 400, nunca llama a generarGuionConVoz", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "consejos_numerados", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta" };
    usuarioActual = { ...USUARIO_ADMIN, cloudinary_name: null };

    const res = await POST(req(), contexto());
    expect(res.status).toBe(400);
    expect(generarGuionConVozMock).not.toHaveBeenCalled();
  });

  it("consejos_numerados: cuando generarGuionConVoz() falla, propaga su status/error tal cual, sin guardar nada", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "consejos_numerados", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta" };
    generarGuionConVozMock.mockResolvedValue({ ok: false, status: 502, error: "No se pudo generar un guion válido (narración/visual) después de varios intentos.", resumenErrores: ["e1: algo falló"] });

    const res = await POST(req(), contexto());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.resumenErrores).toEqual(["e1: algo falló"]);
    expect(updatesRealizados.length).toBe(0);
  });

  it("mito_verdad (receta de siempre): nunca llama a generarGuionConVoz, sigue usando el prompt viejo", async () => {
    piezaActual = { id: "pieza-1", receta_organica: "mito_verdad", estado: "borrador", media_ids: null, semana: "2026-11-09", tema: null, gancho_tipo: "pregunta" };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_VALIDO_CRUDO));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req(), contexto());

    expect(res.status).toBe(200);
    expect(generarGuionConVozMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
