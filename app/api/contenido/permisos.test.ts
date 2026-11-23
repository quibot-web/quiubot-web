// Permisos de /contenido (lanzamiento 30 nov 2026): un usuario nunca puede
// ver, editar, renderizar ni publicar piezas de otro. Base en memoria que
// SÍ aplica los filtros de cada consulta (eq, in, neq...): si una ruta se
// olvida de filtrar por dueño, la pieza ajena aparece y el test falla.
// Nunca contra la base real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]>;
let escrituras: { tabla: string; op: string; filas: Fila[]; valores?: Fila }[];

function consulta(tabla: string) {
  const filtros: ((f: Fila) => boolean)[] = [];
  let op: "select" | "update" | "insert" | "delete" = "select";
  let valores: Fila = {};
  let conteo = false;
  let limite = Infinity;
  const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every((fn) => fn(f)));
  const ejecutar = () => {
    if (op === "insert") {
      const nuevas = (Array.isArray(valores) ? valores : [valores]).map((v, i) => ({ id: `nueva-${tabla}-${(tablas[tabla] ?? []).length + i}`, ...v }));
      tablas[tabla] = [...(tablas[tabla] ?? []), ...nuevas];
      escrituras.push({ tabla, op, filas: nuevas });
      return nuevas;
    }
    const encontradas = filas().slice(0, limite);
    if (op === "update") {
      for (const f of encontradas) Object.assign(f, valores);
      escrituras.push({ tabla, op, filas: encontradas.map((f) => ({ ...f })), valores });
    }
    if (op === "delete") {
      tablas[tabla] = (tablas[tabla] ?? []).filter((f) => !encontradas.includes(f));
      escrituras.push({ tabla, op, filas: encontradas });
    }
    return encontradas;
  };
  const q: Record<string, unknown> = {
    select: (_c?: string, o?: { count?: string; head?: boolean }) => {
      if (o?.count) conteo = true;
      return q;
    },
    eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
    neq: (c: string, v: unknown) => (filtros.push((f) => f[c] !== v), q),
    in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[c])), q),
    gte: () => q,
    lte: () => q,
    lt: () => q,
    gt: () => q,
    is: (c: string, v: unknown) => (filtros.push((f) => (f[c] ?? null) === v), q),
    not: (c: string, _o: string, v: unknown) => (filtros.push((f) => (f[c] ?? null) !== v), q),
    or: () => q,
    order: () => q,
    range: () => q,
    limit: (n: number) => ((limite = n), q),
    update: (v: Fila) => ((op = "update"), (valores = v), q),
    insert: (v: Fila) => ((op = "insert"), (valores = v), q),
    delete: () => ((op = "delete"), q),
    single: async () => {
      const r = ejecutar();
      return { data: r[0] ?? null, error: r[0] ? null : { message: "no rows" } };
    },
    maybeSingle: async () => ({ data: ejecutar()[0] ?? null, error: null }),
    then: (resolver: (v: unknown) => void) => {
      const r = ejecutar();
      resolver(conteo ? { count: r.length, data: null, error: null } : { data: r, error: null });
    },
  };
  return q;
}

const sesion = vi.fn();
vi.mock("@/auth", () => ({ auth: () => sesion() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: (t: string) => consulta(t), rpc: async () => ({ data: [], error: null }) } }));
vi.mock("@/lib/crypto", () => ({ desencriptarSiHaceFalta: (x: string) => x }));
vi.mock("@/lib/rateLimit", () => ({ verificarLimite: () => true }));
vi.mock("@/lib/registrarError", () => ({ registrarError: vi.fn() }));
const generarGuion = vi.fn();
vi.mock("@/app/lib/videoOrganico/generarGuionConVoz", () => ({ generarGuionConVoz: (...a: unknown[]) => generarGuion(...a), llamarOpenAI: vi.fn(), regenerarVozParaGuion: vi.fn() }));
vi.mock("@/app/lib/videoOrganico/generarVoz", () => ({ transcribirAudioFinal: vi.fn() }));

const rutaLista = await import("./route");
const rutaPieza = await import("./[id]/route");
const rutaGuion = await import("./[id]/guion/route");
const rutaSerie = await import("./[id]/serie/route");
const rutaVideo = await import("./[id]/video-listo/route");
const rutaVoz = await import("./[id]/control-voz/route");
const rutaVision = await import("./[id]/control-calidad/route");
const rutaRecompactar = await import("./[id]/recompactar/route");
const rutaAcceso = await import("./acceso/route");
const rutaMusica = await import("./musica/route");

const futuro = (dias: number) => new Date(Date.now() + dias * 86400e3).toISOString();
const PIEZA_DE_B = "pieza-b";
const ctx = (id = PIEZA_DE_B) => ({ params: Promise.resolve({ id }) });
const json = (url: string, metodo: string, cuerpo?: unknown) => new NextRequest(`http://x${url}`, { method: metodo, ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}) });
const form = (url: string, campo: string) => {
  const f = new FormData();
  f.set(campo, new Blob([new Uint8Array(64)], { type: "application/octet-stream" }), "x");
  return new NextRequest(`http://x${url}`, { method: "POST", body: f });
};
const como = (email: string) => sesion.mockResolvedValue({ user: { email } });

const GUION_B = { vozUrl: "https://res.cloudinary.com/b/voz.mp3", escenas: [{ id: "e1", narracion: "Hola" }], musica: { pista_id: null } };

beforeEach(() => {
  escrituras = [];
  tablas = {
    usuarios: [
      { id: "a", email: "a@cliente.com", rol: "user", activo: true, fecha_vencimiento: futuro(20), en_trial: false, openai_key: "ka", cloudinary_name: "ca", cloudinary_key: "k", cloudinary_secret: "s" },
      { id: "b", email: "b@cliente.com", rol: "user", activo: true, fecha_vencimiento: futuro(20), en_trial: false, openai_key: "kb", cloudinary_name: "cb", cloudinary_key: "k", cloudinary_secret: "s" },
      { id: "adm", email: "admin@quiubot.com", rol: "admin", activo: true, fecha_vencimiento: null, en_trial: false },
      { id: "vencido", email: "v@cliente.com", rol: "user", activo: true, fecha_vencimiento: futuro(-1), en_trial: false },
      { id: "prueba", email: "p@cliente.com", rol: "user", activo: false, fecha_vencimiento: null, en_trial: true, trial_termina_en: futuro(5) },
    ],
    publicaciones_organicas: [
      { id: PIEZA_DE_B, user_id: "b", estado: "borrador", tema: "Tema de B", receta_organica: "consejos_numerados", semana: "2026-11-23", programada_para: futuro(3), guion: GUION_B, media_ids: null, control_calidad: null },
      { id: "pieza-b-lista", user_id: "b", estado: "lista", tema: "Lista de B", receta_organica: "consejos_numerados", semana: "2026-11-23", programada_para: futuro(3), guion: GUION_B, url_video: "https://v.mp4", control_calidad: { aprobado: false } },
      { id: "pieza-a", user_id: "a", estado: "error", tipo_error: "calidad", tema: "Tema de A", receta_organica: "consejos_numerados", semana: "2026-11-23", programada_para: futuro(3), guion: null, control_calidad: { aprobado: false } },
    ],
    album_creativos: [{ id: "foto-b", user_id: "b", url_imagen: "https://b.jpg", tipo: "imagen" }],
    productos: [{ id: "prod-b", user_id: "b" }],
    marcas: [],
    pistas_musicales: [
      { id: "pista-licencia", activo: true, licencia_url: "https://licencia", nombre: "Con licencia", mood: "alegre" },
      { id: "pista-pruebas", activo: true, licencia_url: null, nombre: "Solo pruebas", mood: "alegre" },
    ],
  };
  generarGuion.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
});

const piezaB = () => tablas.publicaciones_organicas.find((p) => p.id === PIEZA_DE_B)!;
const escriturasEnPiezasDeB = () => escrituras.filter((e) => e.tabla === "publicaciones_organicas" && e.op !== "select" && e.filas.some((f) => f.user_id === "b"));

describe("permisos de /contenido: un usuario no toca piezas de otro", () => {
  it("VER: A no puede abrir la pieza de B (404, igual que si no existiera) ni su calendario", async () => {
    como("a@cliente.com");
    expect((await rutaPieza.GET(json(`/api/contenido/${PIEZA_DE_B}`, "GET"), ctx())).status).toBe(404);
    const cal = await (await rutaLista.GET(json("/api/contenido?usuario=b", "GET"))).json();
    expect((cal.piezas as Fila[]).map((p) => p.id)).toEqual(["pieza-a"]);
  });

  it("EDITAR: ninguna acción de A cambia una pieza de B (editar, tema, música, reprogramar, eliminar, regenerar voz)", async () => {
    como("a@cliente.com");
    const acciones = [
      { accion: "editar", guion: GUION_B },
      { accion: "tema", tema: "robado" },
      { accion: "musica", pista_id: "pista-licencia" },
      { accion: "reprogramar", programada_para: futuro(5) },
      { accion: "eliminar" },
      { accion: "regenerar_voz" },
    ];
    for (const cuerpo of acciones) {
      const res = await rutaPieza.PATCH(json(`/api/contenido/${PIEZA_DE_B}`, "PATCH", cuerpo), ctx());
      expect(res.status, cuerpo.accion).toBeGreaterThanOrEqual(400);
    }
    expect(escriturasEnPiezasDeB()).toEqual([]);
    expect(piezaB().tema).toBe("Tema de B");
    expect((await rutaSerie.POST(json(`/api/contenido/${PIEZA_DE_B}/serie`, "POST", { partes: [{ idea: "uno uno", programada_para: futuro(1) }, { idea: "dos dos", programada_para: futuro(2) }] }), ctx())).status).toBe(404);
    expect(escriturasEnPiezasDeB()).toEqual([]);
  });

  it("GENERAR: A no puede generar el guion de una pieza de B (y nunca se gasta su llave de OpenAI en ella)", async () => {
    como("a@cliente.com");
    const res = await rutaGuion.POST(json(`/api/contenido/${PIEZA_DE_B}/guion`, "POST", {}), ctx());
    expect(res.status).toBe(404);
    expect(generarGuion).not.toHaveBeenCalled();
  });

  it("RENDERIZAR: A no puede iniciar el render, subir el video, guardar el control de calidad ni usar los controles de voz/visión/recompactar de una pieza de B", async () => {
    como("a@cliente.com");
    for (const cuerpo of [{ accion: "iniciar_render" }, { accion: "guardar_calidad", control_calidad: { aprobado: true } }, { accion: "registrar_respaldo_ilustrado", motivo: "x" }]) {
      expect((await rutaPieza.PATCH(json(`/api/contenido/${PIEZA_DE_B}`, "PATCH", cuerpo), ctx())).status, cuerpo.accion).toBeGreaterThanOrEqual(400);
    }
    expect((await rutaVideo.POST(form(`/api/contenido/${PIEZA_DE_B}/video-listo`, "archivo"), ctx())).status).toBe(404);
    expect((await rutaVoz.POST(form(`/api/contenido/${PIEZA_DE_B}/control-voz`, "audio"), ctx())).status).toBe(404);
    expect((await rutaVision.POST(json(`/api/contenido/${PIEZA_DE_B}/control-calidad`, "POST", { cuadros: [{ etiqueta: "1", dataUrl: "data:image/png;base64,AA" }] }), ctx())).status).toBe(404);
    expect((await rutaRecompactar.POST(json(`/api/contenido/${PIEZA_DE_B}/recompactar`, "POST", { guion: GUION_B, crudo: { palabrasPorEscenaCrudo: [], silencios: [] } }), ctx())).status).toBe(404);
    expect(escriturasEnPiezasDeB()).toEqual([]);
    // Nunca se llamó a OpenAI ni a nada externo con datos de B.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PUBLICAR: A no puede publicar ahora ni forzar la publicación de una pieza de B", async () => {
    como("a@cliente.com");
    for (const [id, cuerpo] of [
      [PIEZA_DE_B, { accion: "publicar_ahora" }],
      ["pieza-b-lista", { accion: "publicar_ahora" }],
      ["pieza-b-lista", { accion: "publicar_igual" }],
    ] as const) {
      expect((await rutaPieza.PATCH(json(`/api/contenido/${id}`, "PATCH", cuerpo), ctx(id))).status, `${id} ${cuerpo.accion}`).toBeGreaterThanOrEqual(400);
    }
    expect(escriturasEnPiezasDeB()).toEqual([]);
  });

  it("A no puede armar una pieza con el producto o las fotos del álbum de B", async () => {
    como("a@cliente.com");
    expect((await rutaLista.POST(json("/api/contenido", "POST", { receta_organica: "producto_en_uso", programada_para: futuro(2), producto_id: "prod-b" }))).status).toBe(400);
    expect((await rutaLista.POST(json("/api/contenido", "POST", { receta_organica: "producto_en_uso", programada_para: futuro(2), media_ids: ["foto-b"] }))).status).toBe(400);
    expect(escrituras.filter((e) => e.op === "insert")).toEqual([]);
  });
});

describe("admin: ve todo, pero solo cambia lo suyo", () => {
  it("admin puede abrir la pieza de un cliente y su calendario (?usuario=), con el álbum del DUEÑO", async () => {
    como("admin@quiubot.com");
    tablas.publicaciones_organicas[0].media_ids = ["foto-b"];
    const res = await rutaPieza.GET(json(`/api/contenido/${PIEZA_DE_B}`, "GET"), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).medios["foto-b"]).toBeDefined();
    const cal = await (await rutaLista.GET(json("/api/contenido?usuario=b", "GET"))).json();
    expect((cal.piezas as Fila[]).map((p) => p.id).sort()).toEqual([PIEZA_DE_B, "pieza-b-lista"]);
  });

  it("admin no cambia piezas de un cliente (así nunca se usa la llave o las credenciales equivocadas)", async () => {
    como("admin@quiubot.com");
    await rutaPieza.PATCH(json(`/api/contenido/${PIEZA_DE_B}`, "PATCH", { accion: "tema", tema: "cambiado por admin" }), ctx());
    expect(piezaB().tema).toBe("Tema de B");
    expect(escriturasEnPiezasDeB()).toEqual([]);
  });
});

describe("suscripción activa (en vez de rol admin)", () => {
  it("cliente con plan pagado o en prueba vigente: entra; con el plan vencido: 403 con el motivo, en todas las rutas", async () => {
    como("a@cliente.com");
    expect((await rutaAcceso.GET()).status).toBe(200);
    como("p@cliente.com");
    expect((await rutaAcceso.GET()).status).toBe(200);
    como("v@cliente.com");
    const res = await rutaAcceso.GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ codigo: "suscripcion_inactiva" });
    expect((await rutaLista.GET(json("/api/contenido", "GET"))).status).toBe(403);
    expect((await rutaPieza.GET(json("/api/contenido/x", "GET"), ctx("x"))).status).toBe(403);
    expect((await rutaGuion.POST(json("/api/contenido/x/guion", "POST", {}), ctx("x"))).status).toBe(403);
    expect((await rutaMusica.GET()).status).toBe(403);
  });

  it("sin sesión: 401", async () => {
    sesion.mockResolvedValue(null);
    expect((await rutaAcceso.GET()).status).toBe(401);
    expect((await rutaPieza.GET(json(`/api/contenido/${PIEZA_DE_B}`, "GET"), ctx())).status).toBe(401);
  });
});

describe("lo que el cliente no puede hacer ni en sus propias piezas", () => {
  it("saltarse el control de calidad ('Forzar de todos modos' / 'Publicar de todos modos') es solo de admin", async () => {
    como("a@cliente.com");
    const res = await rutaPieza.PATCH(json("/api/contenido/pieza-a", "PATCH", { accion: "forzar_sin_calidad" }), ctx("pieza-a"));
    expect(res.status).toBe(403);
    expect(tablas.publicaciones_organicas.find((p) => p.id === "pieza-a")!.estado).toBe("error");
  });

  it("reel rechazado por calidad: su dueño lo devuelve a borrador para arreglarlo (guion intacto, hallazgos guardados); otro usuario no puede", async () => {
    tablas.publicaciones_organicas.find((p) => p.id === "pieza-a")!.control_calidad = { aprobado: false, hallazgos: ["x"] };
    como("b@cliente.com");
    expect((await rutaPieza.PATCH(json("/api/contenido/pieza-a", "PATCH", { accion: "volver_a_borrador" }), ctx("pieza-a"))).status).toBe(404);
    expect(tablas.publicaciones_organicas.find((p) => p.id === "pieza-a")!.estado).toBe("error");
    como("a@cliente.com");
    expect((await rutaPieza.PATCH(json("/api/contenido/pieza-a", "PATCH", { accion: "volver_a_borrador" }), ctx("pieza-a"))).status).toBe(200);
    const a = tablas.publicaciones_organicas.find((p) => p.id === "pieza-a")!;
    expect(a).toMatchObject({ estado: "borrador", tipo_error: null, control_calidad: { hallazgosPrevios: ["x"] } });
    // Una pieza que no fue rechazada por calidad no se toca así.
    expect((await rutaPieza.PATCH(json("/api/contenido/pieza-a", "PATCH", { accion: "volver_a_borrador" }), ctx("pieza-a"))).status).toBe(400);
  });

  it("música: el cliente solo ve y solo puede elegir pistas con licencia; admin ve también las de prueba", async () => {
    como("a@cliente.com");
    expect(((await (await rutaMusica.GET()).json()).pistas as Fila[]).map((p) => p.id)).toEqual(["pista-licencia"]);
    como("admin@quiubot.com");
    expect(((await (await rutaMusica.GET()).json()).pistas as Fila[]).map((p) => p.id)).toEqual(["pista-licencia", "pista-pruebas"]);
  });
});
