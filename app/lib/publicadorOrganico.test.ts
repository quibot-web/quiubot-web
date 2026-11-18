// Publicador automático (paso 4) con Supabase y Meta mockeados -- nunca
// contra la base real ni contra Instagram. Supabase es una tabla en
// memoria con los filtros que usa el publicador; Meta es un fetch
// falso que responde según la URL.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let rpcLlamadas: unknown[] = [];
let rpcFalla = false;

function crearConsulta(tabla: string) {
  const filtros: ((f: Fila) => boolean)[] = [];
  let operacion: { tipo: "select" } | { tipo: "update"; valores: Fila } | { tipo: "insert"; valores: Fila } = { tipo: "select" };
  let limite: number | null = null;

  const ejecutar = () => {
    const filas = (tablas[tabla] ??= []);
    if (operacion.tipo === "insert") {
      filas.push({ id: `auto-${filas.length + 1}`, ...operacion.valores });
      return { data: null, error: null };
    }
    let coincidentes = filas.filter((f) => filtros.every((fn) => fn(f)));
    if (limite !== null) coincidentes = coincidentes.slice(0, limite);
    if (operacion.tipo === "update") {
      const valores = operacion.valores;
      coincidentes.forEach((f) => Object.assign(f, valores));
    }
    return { data: coincidentes.map((f) => ({ ...f })), error: null };
  };

  const q = {
    select: () => q,
    update: (valores: Fila) => {
      operacion = { tipo: "update", valores };
      return q;
    },
    insert: (valores: Fila) => {
      operacion = { tipo: "insert", valores };
      return q;
    },
    eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
    in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[c])), q),
    lt: (c: string, v: string) => (filtros.push((f) => String(f[c]) < v), q),
    lte: (c: string, v: string) => (filtros.push((f) => String(f[c]) <= v), q),
    not: (c: string) => (filtros.push((f) => f[c] !== null && f[c] !== undefined), q),
    order: () => q,
    limit: (n: number) => ((limite = n), q),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve(ejecutar()),
  };
  return q;
}

// Imita la RPC con los filtros del SQL nuevo... salvo cuando un test
// quiere simular la RPC VIEJA (sin filtros) para probar la segunda barrera.
let rpcSinFiltros = false;
function rpcReclamar() {
  const ahora = new Date().toISOString();
  const pistas = tablas.pistas_musicales ?? [];
  const elegibles = (tablas.publicaciones_organicas ?? []).filter((p) => {
    if (p.estado !== "lista" || String(p.programada_para) > ahora) return false;
    if (rpcSinFiltros) return true;
    if (p.plataforma !== "instagram") return false;
    const qc = p.control_calidad as { aprobado?: boolean; publicarIgual?: boolean } | null;
    if (qc && qc.aprobado === false && qc.publicarIgual !== true) return false;
    const pistaId = (p.guion as { musica?: { pista_id?: string } } | null)?.musica?.pista_id;
    if (pistaId) {
      const pista = pistas.find((m) => m.id === pistaId);
      if (!pista?.licencia_url || !(pista.plataformas_permitidas as string[] | null)?.includes("instagram")) return false;
    }
    return true;
  });
  elegibles.forEach((p) => Object.assign(p, { estado: "publicando", actualizado_en: ahora }));
  return elegibles.map((p) => ({ ...p }));
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (tabla: string) => crearConsulta(tabla),
    rpc: async (nombre: string, args: unknown) => {
      rpcLlamadas.push({ nombre, args });
      if (rpcFalla) return { data: null, error: { message: "boom" } };
      return { data: rpcReclamar(), error: null };
    },
  },
}));

const registrarErrorMock = vi.fn();
vi.mock("@/lib/registrarError", () => ({ registrarError: (...args: unknown[]) => registrarErrorMock(...args) }));

// Meta falso.
type RespuestaMeta = { status?: number; body: unknown } | (() => never);
let meta: {
  cuenta: RespuestaMeta;
  cupo: RespuestaMeta;
  crear: RespuestaMeta;
  estado: RespuestaMeta;
  publicar: RespuestaMeta;
  permalink: RespuestaMeta;
};
const llamadasMeta: { url: string; body?: unknown }[] = [];

function responder(r: RespuestaMeta) {
  if (typeof r === "function") r();
  const { status = 200, body } = r as { status?: number; body: unknown };
  return new Response(JSON.stringify(body), { status });
}

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  llamadasMeta.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (url.includes("/content_publishing_limit")) return responder(meta.cupo);
  if (url.includes("/media_publish")) return responder(meta.publicar);
  if (url.includes("fields=status_code")) return responder(meta.estado);
  if (url.includes("fields=permalink")) return responder(meta.permalink);
  if (url.endsWith("/media")) return responder(meta.crear);
  if (url.includes("instagram_business_account")) return responder(meta.cuenta);
  if (url.includes("/me/accounts")) return responder({ body: { data: [] } });
  throw new Error(`fetch no mockeado: ${url}`);
});
vi.stubGlobal("fetch", fetchMock);

const {
  ejecutarPublicadorOrganico,
  motivoBloqueoPublicacion,
  captionParaInstagram,
  rescatarAtascadas,
  procesarContenedores,
  reclamarYCrearContenedores,
  vencerPiezasSinVideo,
  avisarListasBloqueadas,
  MAX_INTENTOS_TRANSITORIOS,
} = await import("./publicadorOrganico");

const haceMin = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();
const enMin = (m: number) => new Date(Date.now() + m * 60 * 1000).toISOString();

function pieza(extra: Fila = {}): Fila {
  return {
    id: "p1",
    user_id: "u1",
    plataforma: "instagram",
    estado: "lista",
    programada_para: haceMin(1),
    guion: { musica: { pista_id: null, volumen: 0.2 } },
    caption: "Hola",
    hashtags: ["ventas", "#marketing"],
    url_video: "https://res.cloudinary.com/demo/video/upload/v1/reel.mp4",
    control_calidad: { aprobado: true },
    ig_container_id: null,
    ig_media_id: null,
    permalink: null,
    intentos: 0,
    actualizado_en: haceMin(1),
    ...extra,
  };
}

const piezaDb = (id = "p1") => tablas.publicaciones_organicas.find((p) => p.id === id)!;
const mensajes = () => tablas.mensajes_equipo ?? [];

beforeEach(() => {
  tablas = {
    usuarios: [{ id: "u1", email: "marca@quiubot.com", meta_page_id: "page1", meta_access_token: "tok" }],
    publicaciones_organicas: [],
    pistas_musicales: [
      { id: "11111111-1111-4111-8111-111111111111", licencia_url: "https://licencia", plataformas_permitidas: ["instagram"] },
      { id: "22222222-2222-4222-8222-222222222222", licencia_url: null, plataformas_permitidas: null },
    ],
    mensajes_equipo: [],
  };
  rpcLlamadas = [];
  rpcFalla = false;
  rpcSinFiltros = false;
  llamadasMeta.length = 0;
  registrarErrorMock.mockClear();
  meta = {
    cuenta: { body: { instagram_business_account: { id: "ig1", username: "marca" } } },
    cupo: { body: { data: [{ quota_usage: 2, config: { quota_total: 50 } }] } },
    crear: { body: { id: "cont1" } },
    estado: { body: { status_code: "FINISHED" } },
    publicar: { body: { id: "media1" } },
    permalink: { body: { permalink: "https://www.instagram.com/reel/abc/" } },
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("reglas puras", () => {
  const conLicencia = new Set(["11111111-1111-4111-8111-111111111111"]);

  it("bloquea una pieza forzada sin 'Publicar de todos modos'", () => {
    expect(motivoBloqueoPublicacion({ plataforma: "instagram", guion: null, control_calidad: { aprobado: false, forzado: true } }, conLicencia)).toBe("requiere_confirmacion");
  });
  it("deja pasar la forzada con publicarIgual:true", () => {
    expect(motivoBloqueoPublicacion({ plataforma: "instagram", guion: null, control_calidad: { aprobado: false, forzado: true, publicarIgual: true } }, conLicencia)).toBeNull();
  });
  it("bloquea música sin licencia para Instagram, deja pasar la que sí tiene", () => {
    expect(motivoBloqueoPublicacion({ plataforma: "instagram", guion: { musica: { pista_id: "22222222-2222-4222-8222-222222222222" } }, control_calidad: null }, conLicencia)).toBe("musica_sin_licencia");
    expect(motivoBloqueoPublicacion({ plataforma: "instagram", guion: { musica: { pista_id: "11111111-1111-4111-8111-111111111111" } }, control_calidad: null }, conLicencia)).toBeNull();
  });
  it("nunca publica una pieza de TikTok en Instagram", () => {
    expect(motivoBloqueoPublicacion({ plataforma: "tiktok", guion: null, control_calidad: null }, conLicencia)).toBe("no_es_instagram");
  });
  it("caption: texto + hashtags siempre con #, máximo 2.200", () => {
    expect(captionParaInstagram("Hola", ["ventas", "#marketing"])).toBe("Hola\n\n#ventas #marketing");
    expect(captionParaInstagram("x".repeat(3000), []).length).toBe(2200);
  });
});

describe("reclamar → contenedor", () => {
  it("pieza elegible: revisa el cupo, crea el contenedor REELS con urlVideoCompatible y pasa a procesando", async () => {
    tablas.publicaciones_organicas.push(pieza());
    const r = await reclamarYCrearContenedores();
    expect(r.contenedores).toBe(1);
    expect(piezaDb()).toMatchObject({ estado: "procesando", ig_container_id: "cont1" });
    expect(rpcLlamadas).toEqual([{ nombre: "reclamar_publicaciones_organicas_vencidas", args: { p_limite: 10 } }]);

    const iCupo = llamadasMeta.findIndex((l) => l.url.includes("content_publishing_limit"));
    const iCrear = llamadasMeta.findIndex((l) => l.url.endsWith("/ig1/media"));
    expect(iCupo).toBeGreaterThanOrEqual(0);
    expect(iCupo).toBeLessThan(iCrear);
    expect(llamadasMeta[iCrear].body).toMatchObject({
      media_type: "REELS",
      share_to_feed: true,
      caption: "Hola\n\n#ventas #marketing",
      video_url: "https://res.cloudinary.com/demo/video/upload/f_mp4,vc_h264,q_auto,w_1080/v1/reel.mp4",
    });
  });

  it("pieza programada en el futuro: no se toca", async () => {
    tablas.publicaciones_organicas.push(pieza({ programada_para: enMin(15) }));
    await reclamarYCrearContenedores();
    expect(piezaDb().estado).toBe("lista");
    expect(llamadasMeta).toHaveLength(0);
  });

  it("NO reclama una pieza forzada sin la marca explícita (ni llama a Meta)", async () => {
    tablas.publicaciones_organicas.push(pieza({ control_calidad: { aprobado: false, forzado: true } }));
    await reclamarYCrearContenedores();
    expect(piezaDb().estado).toBe("lista");
    expect(llamadasMeta).toHaveLength(0);
  });

  it("sí publica la forzada cuando el admin confirmó 'Publicar de todos modos'", async () => {
    tablas.publicaciones_organicas.push(pieza({ control_calidad: { aprobado: false, forzado: true, publicarIgual: true } }));
    await reclamarYCrearContenedores();
    expect(piezaDb().estado).toBe("procesando");
  });

  it("segunda barrera: aunque la RPC vieja (sin filtros) la reclame, una forzada / sin licencia / TikTok vuelve a 'lista' sin llamar a Meta", async () => {
    rpcSinFiltros = true;
    tablas.publicaciones_organicas.push(
      pieza({ id: "forzada", control_calidad: { aprobado: false, forzado: true } }),
      pieza({ id: "musica", guion: { musica: { pista_id: "22222222-2222-4222-8222-222222222222" } } }),
      pieza({ id: "tiktok", plataforma: "tiktok" })
    );
    const r = await reclamarYCrearContenedores();
    expect(r.devueltas).toBe(3);
    expect(["forzada", "musica", "tiktok"].map((id) => piezaDb(id).estado)).toEqual(["lista", "lista", "lista"]);
    expect(llamadasMeta.some((l) => l.url.includes("/media"))).toBe(false);
  });

  it("sin cupo: vuelve a 'lista' sin crear contenedor ni gastar intentos", async () => {
    meta.cupo = { body: { data: [{ quota_usage: 50, config: { quota_total: 50 } }] } };
    tablas.publicaciones_organicas.push(pieza());
    const r = await reclamarYCrearContenedores();
    expect(r.sinCupo).toBe(1);
    expect(piezaDb()).toMatchObject({ estado: "lista", intentos: 0 });
    expect(llamadasMeta.some((l) => l.url.endsWith("/media"))).toBe(false);
  });

  it("token vencido al crear el contenedor: error 'reconexion', sin reintento, aviso en el chat", async () => {
    meta.crear = { status: 400, body: { error: { code: 190, message: "Error validating access token: raw" } } };
    tablas.publicaciones_organicas.push(pieza());
    await reclamarYCrearContenedores();
    expect(piezaDb()).toMatchObject({ estado: "error", tipo_error: "reconexion" });
    expect(String(piezaDb().error)).not.toContain("raw");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ asistente: "publicador", tipo_evento: "reel_publicacion_error" });
  });

  it("permiso faltante (código 10): también pide reconectar", async () => {
    meta.crear = { status: 400, body: { error: { code: 10, message: "permission" } } };
    tablas.publicaciones_organicas.push(pieza());
    await reclamarYCrearContenedores();
    expect(piezaDb()).toMatchObject({ estado: "error", tipo_error: "reconexion" });
  });

  it("error pasajero: vuelve a 'lista' sumando un intento; al llegar al tope pasa a error", async () => {
    meta.crear = { status: 500, body: { error: { code: 2, is_transient: true } } };
    tablas.publicaciones_organicas.push(pieza());
    await reclamarYCrearContenedores();
    expect(piezaDb()).toMatchObject({ estado: "lista", intentos: 1 });

    piezaDb().intentos = MAX_INTENTOS_TRANSITORIOS - 1;
    await reclamarYCrearContenedores();
    expect(piezaDb()).toMatchObject({ estado: "error", tipo_error: "meta_rechazo" });
  });

  it("Meta rechaza el video: error sin mensaje crudo, registrarError con el detalle técnico", async () => {
    meta.crear = { status: 400, body: { error: { code: 100, message: "Invalid video_url RAW" } } };
    tablas.publicaciones_organicas.push(pieza());
    await reclamarYCrearContenedores();
    expect(piezaDb()).toMatchObject({ estado: "error", tipo_error: "meta_rechazo" });
    expect(String(piezaDb().error)).not.toContain("RAW");
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "publicador_organico", detalleTecnico: expect.stringContaining("RAW") }));
  });

  it("si la RPC falla, no toca nada y registra el error", async () => {
    rpcFalla = true;
    tablas.publicaciones_organicas.push(pieza());
    await reclamarYCrearContenedores();
    expect(piezaDb().estado).toBe("lista");
    expect(registrarErrorMock).toHaveBeenCalled();
  });
});

describe("procesando → publicada", () => {
  it("FINISHED: media_publish, guarda ig_media_id y permalink, avisa 'publicado' con el link", async () => {
    tablas.publicaciones_organicas.push(pieza({ estado: "procesando", ig_container_id: "cont1" }));
    const r = await procesarContenedores();
    expect(r.publicadas).toBe(1);
    expect(piezaDb()).toMatchObject({ estado: "publicada", ig_media_id: "media1", permalink: "https://www.instagram.com/reel/abc/" });
    const publish = llamadasMeta.find((l) => l.url.includes("/media_publish"));
    expect(publish?.body).toMatchObject({ creation_id: "cont1" });
    expect(mensajes()[0]).toMatchObject({ asistente: "publicador", tipo_evento: "reel_publicado" });
    expect(JSON.stringify(mensajes()[0].contenido)).toContain("https://www.instagram.com/reel/abc/");
  });

  it("IN_PROGRESS: espera sin tocar la pieza ni su actualizado_en", async () => {
    meta.estado = { body: { status_code: "IN_PROGRESS" } };
    const antes = haceMin(5);
    tablas.publicaciones_organicas.push(pieza({ estado: "procesando", ig_container_id: "cont1", actualizado_en: antes }));
    const r = await procesarContenedores();
    expect(r.esperando).toBe(1);
    expect(piezaDb()).toMatchObject({ estado: "procesando", actualizado_en: antes });
    expect(llamadasMeta.some((l) => l.url.includes("/media_publish"))).toBe(false);
  });

  it("ERROR/EXPIRED: pasa a error, nunca publica", async () => {
    meta.estado = { body: { status_code: "ERROR" } };
    tablas.publicaciones_organicas.push(pieza({ estado: "procesando", ig_container_id: "cont1" }));
    await procesarContenedores();
    expect(piezaDb()).toMatchObject({ estado: "error", tipo_error: "meta_rechazo" });
    expect(llamadasMeta.some((l) => l.url.includes("/media_publish"))).toBe(false);
  });

  it("falla de red en media_publish: error 'revisar_publicacion', sin reintento", async () => {
    meta.publicar = () => {
      throw new Error("socket hang up");
    };
    tablas.publicaciones_organicas.push(pieza({ estado: "procesando", ig_container_id: "cont1" }));
    await procesarContenedores();
    expect(piezaDb()).toMatchObject({ estado: "error", tipo_error: "revisar_publicacion" });
    await procesarContenedores();
    expect(llamadasMeta.filter((l) => l.url.includes("/media_publish"))).toHaveLength(1);
  });

  it("si el permalink falla después de publicar, igual queda publicada (nunca 'error')", async () => {
    meta.permalink = () => {
      throw new Error("timeout");
    };
    tablas.publicaciones_organicas.push(pieza({ estado: "procesando", ig_container_id: "cont1" }));
    await procesarContenedores();
    expect(piezaDb()).toMatchObject({ estado: "publicada", ig_media_id: "media1", permalink: null });
  });
});

describe("atascadas y vencidas", () => {
  it("publicando/procesando > 30 min → error 'revisar_publicacion' sin reintento; renderizando > 30 min → aprobada", async () => {
    tablas.publicaciones_organicas.push(
      pieza({ id: "pub", estado: "publicando", actualizado_en: haceMin(31) }),
      pieza({ id: "proc", estado: "procesando", ig_container_id: "c", actualizado_en: haceMin(31) }),
      pieza({ id: "rend", estado: "renderizando", actualizado_en: haceMin(31), programada_para: enMin(60) }),
      pieza({ id: "reciente", estado: "procesando", ig_container_id: "c2", actualizado_en: haceMin(10) })
    );
    const r = await rescatarAtascadas();
    expect(r).toEqual({ renderizandoDevueltas: 1, publicacionesARevisar: 2 });
    expect(piezaDb("pub")).toMatchObject({ estado: "error", tipo_error: "revisar_publicacion" });
    expect(piezaDb("proc")).toMatchObject({ estado: "error", tipo_error: "revisar_publicacion" });
    expect(piezaDb("rend").estado).toBe("aprobada");
    expect(piezaDb("reciente").estado).toBe("procesando");
    expect(mensajes().filter((m) => m.tipo_evento === "reel_publicacion_error")).toHaveLength(2);
  });

  it("pieza sin video a la que se le pasó la hora: vencida + aviso 'vencido' una sola vez", async () => {
    tablas.publicaciones_organicas.push(pieza({ estado: "aprobada", url_video: null }));
    expect(await vencerPiezasSinVideo()).toBe(1);
    expect(piezaDb().estado).toBe("vencida");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ asistente: "publicador", tipo_evento: "reel_vencido" });
  });

  it("'lista' bloqueada (forzada sin confirmar): avisa una sola vez aunque el cron corra varias veces, y sigue en 'lista'", async () => {
    tablas.publicaciones_organicas.push(pieza({ control_calidad: { aprobado: false, forzado: true } }));
    await avisarListasBloqueadas();
    await avisarListasBloqueadas();
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ tipo_evento: "reel_vencido" });
    expect(piezaDb().estado).toBe("lista");
  });
});

describe("una vuelta completa en dos corridas", () => {
  it("corrida 1 crea el contenedor, corrida 2 publica -- y una tercera no vuelve a publicar", async () => {
    tablas.publicaciones_organicas.push(pieza());
    await ejecutarPublicadorOrganico();
    expect(piezaDb().estado).toBe("procesando");
    await ejecutarPublicadorOrganico();
    expect(piezaDb().estado).toBe("publicada");
    await ejecutarPublicadorOrganico();
    expect(llamadasMeta.filter((l) => l.url.includes("/media_publish"))).toHaveLength(1);
    expect(llamadasMeta.filter((l) => l.url.endsWith("/ig1/media"))).toHaveLength(1);
  });
});
