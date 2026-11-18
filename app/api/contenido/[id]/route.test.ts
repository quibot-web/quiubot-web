// Prueba GET/PATCH /api/contenido/[id] (detalle, editar, aprobar) con
// Supabase mockeado -- nunca contra la base real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fixtureMitoVerdad } from "@/video/fixtures/organico/mitoVerdad";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

let usuarioActual: Record<string, unknown> | null = null;
let piezaActual: Record<string, unknown> | null = null;
let piezasAlbumActual: Record<string, unknown>[] = [];
let marcaInfoActual: Record<string, unknown> | null = { info_adicional: "Vendemos ropa deportiva hecha a mano para mujeres." };
let pistaActual: Record<string, unknown> | null = null;
let countPistasConLicenciaActual = 1;
let filasUpdateActual: { id: string }[] | null = [{ id: "pieza-1" }];
let updatesRealizados: Record<string, unknown>[] = [];
// Consulta "¿hay una parte 2 activa que continúa esta pieza?" (eliminar).
let partes2Actual: { id: string }[] = [];

function chainUsuarios(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }) };
  return obj;
}

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainUsuarios(usuarioActual);
  if (tabla === "marcas") {
    const obj = { select: () => obj, eq: () => obj, maybeSingle: async () => ({ data: marcaInfoActual }) };
    return obj;
  }
  if (tabla === "album_creativos") {
    const obj = { select: () => obj, eq: () => obj, in: async () => ({ data: piezasAlbumActual, error: null }) };
    return obj;
  }
  if (tabla === "pistas_musicales") {
    const obj = {
      select: () => obj,
      eq: () => obj,
      not: () => obj,
      maybeSingle: async () => ({ data: pistaActual }),
      then: (resolve: (v: { count: number; error: unknown }) => void) => resolve({ count: countPistasConLicenciaActual, error: null }),
    };
    return obj;
  }
  if (tabla === "publicaciones_organicas") {
    let huboSelectTrasUpdate = false;
    let esConsultaPartes2 = false;
    const obj = {
      select: () => {
        huboSelectTrasUpdate = true;
        return obj;
      },
      eq: () => obj,
      neq: () => obj,
      limit: () => {
        esConsultaPartes2 = true;
        return obj;
      },
      maybeSingle: async () => ({ data: piezaActual }),
      update: (valores: Record<string, unknown>) => {
        huboSelectTrasUpdate = false;
        updatesRealizados.push(valores);
        return obj;
      },
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
        if (esConsultaPartes2) return resolve({ data: partes2Actual, error: null });
        resolve(huboSelectTrasUpdate ? { data: filasUpdateActual, error: null } : { data: null, error: null });
      },
    };
    return obj;
  }
  throw new Error(`from("${String(tabla)}") no mockeado en este test`);
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}));

const { GET, PATCH } = await import("./route");

const USUARIO_ADMIN = { id: "user-1", rol: "admin" };

function getReq() {
  return new NextRequest("http://localhost/api/contenido/pieza-1");
}
function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/contenido/pieza-1", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
function contexto() {
  return { params: Promise.resolve({ id: "pieza-1" }) };
}

describe("GET /api/contenido/[id]", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    piezaActual = { id: "pieza-1", estado: "borrador", guion: null, media_ids: null };
    piezasAlbumActual = [];
    marcaInfoActual = { info_adicional: "Vendemos ropa deportiva hecha a mano para mujeres." };
    pistaActual = null;
    countPistasConLicenciaActual = 1;
  });

  it("sin sesión: 401", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(getReq(), contexto());
    expect(res.status).toBe(401);
  });

  it("pieza inexistente: 404", async () => {
    piezaActual = null;
    const res = await GET(getReq(), contexto());
    expect(res.status).toBe(404);
  });

  it("devuelve la pieza, sin piezas de álbum: medios vacío", async () => {
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pieza).toEqual(piezaActual);
    expect(body.medios).toEqual({});
  });

  it("con media_ids: resuelve los medios reales del álbum", async () => {
    piezaActual = { ...piezaActual, media_ids: ["demo-1"] };
    piezasAlbumActual = [{ id: "demo-1", url_imagen: "https://res.cloudinary.com/demo/image/upload/v1/foto.jpg", tipo: "imagen" }];
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.medios).toEqual({ "demo-1": { url: "https://res.cloudinary.com/demo/image/upload/v1/foto.jpg", tipo: "imagen" } });
  });

  it("con info_adicional real: avisoInfoIncompleta es false", async () => {
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.avisoInfoIncompleta).toBe(false);
  });

  it("sin info_adicional (solo catálogo, caso real pedido): avisoInfoIncompleta es true", async () => {
    marcaInfoActual = { info_adicional: null };
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.avisoInfoIncompleta).toBe(true);
  });

  it("guion sin pista_id: pistaUrl es null", async () => {
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.pistaUrl).toBe(null);
  });

  it("guion con pista_id real (caso real: reel publicado en silencio total): resuelve la URL de Cloudinary", async () => {
    piezaActual = { ...piezaActual, guion: { musica: { pista_id: "pista-1", volumen: 0.35 } } };
    pistaActual = { public_id: "v123/cancion", cloudinary_name: "demo", licencia_url: "https://licencia.real/x" };
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.pistaUrl).toBe("https://res.cloudinary.com/demo/video/upload/v123/cancion.mp3");
    expect(body.pistaSinLicencia).toBe(false);
  });

  it("pista elegida a mano SIN licencia (solo un admin puede hacerlo): pistaSinLicencia es true", async () => {
    piezaActual = { ...piezaActual, guion: { musica: { pista_id: "pista-1", volumen: 0.35 } } };
    pistaActual = { public_id: "v123/cancion", cloudinary_name: "demo", licencia_url: null };
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.pistaSinLicencia).toBe(true);
  });

  it("sin pista asignada pero SÍ hay pistas con licencia en la biblioteca: avisoSinMusica es false (fue una elección, no falta de licencias)", async () => {
    countPistasConLicenciaActual = 3;
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.avisoSinMusica).toBe(false);
  });

  it("sin pista asignada y CERO pistas con licencia en toda la biblioteca (caso real: 0 de 21): avisoSinMusica es true", async () => {
    countPistasConLicenciaActual = 0;
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(body.avisoSinMusica).toBe(true);
  });
});

describe("PATCH /api/contenido/[id] -- aprobar", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
    piezaActual = { id: "pieza-1", estado: "borrador", guion: fixtureMitoVerdad, caption: "hola", hashtags: ["#a", "#b", "#c"] };
  });

  it("sin guion todavía: 400, nunca llega a actualizar", async () => {
    piezaActual = { id: "pieza-1", estado: "borrador", guion: null, caption: null, hashtags: null };
    const res = await PATCH(patchReq({ accion: "aprobar" }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("pieza que no está en borrador: 400", async () => {
    piezaActual = { ...piezaActual, estado: "lista" };
    const res = await PATCH(patchReq({ accion: "aprobar" }), contexto());
    expect(res.status).toBe(400);
  });

  it("con guion y en borrador: aprueba", async () => {
    const res = await PATCH(patchReq({ accion: "aprobar" }), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(updatesRealizados[0]).toMatchObject({ estado: "aprobada" });
  });

  it("otra pestaña ya la aprobó (carrera perdida): 409", async () => {
    filasUpdateActual = [];
    const res = await PATCH(patchReq({ accion: "aprobar" }), contexto());
    expect(res.status).toBe(409);
  });

  it("pieza con pipeline de voz y narración editada después (hash ya no calza): 400, nunca aprueba", async () => {
    piezaActual = {
      ...piezaActual,
      guion: { ...fixtureMitoVerdad, escenas: fixtureMitoVerdad.escenas, vozUrl: "https://x/voz.mp3", narracionHash: "hash-viejo-que-no-calza" },
    };
    const res = await PATCH(patchReq({ accion: "aprobar" }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("pieza con pipeline de voz y hash SÍ calza con la narración actual: aprueba normal", async () => {
    const { calcularHashNarracion } = await import("@/app/lib/videoOrganico/hashNarracion");
    piezaActual = {
      ...piezaActual,
      guion: { ...fixtureMitoVerdad, vozUrl: "https://x/voz.mp3", narracionHash: calcularHashNarracion(fixtureMitoVerdad.escenas) },
    };
    const res = await PATCH(patchReq({ accion: "aprobar" }), contexto());
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/contenido/[id] -- regenerar_voz", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = { ...USUARIO_ADMIN, openai_key: "key-cifrada", cloudinary_name: "demo", cloudinary_key: "k-cifrada", cloudinary_secret: "s-cifrada" };
    piezaActual = { id: "pieza-1", estado: "borrador", guion: { ...fixtureMitoVerdad, vozUrl: "https://x/voz-vieja.mp3", narracionHash: "hash-viejo" } };
    marcaInfoActual = { voz_tts: "cedar" };
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
  });

  it("pieza sin pipeline de voz: 400", async () => {
    piezaActual = { ...piezaActual, guion: fixtureMitoVerdad };
    const res = await PATCH(patchReq({ accion: "regenerar_voz" }), contexto());
    expect(res.status).toBe(400);
  });

  it("éxito: guarda los campos nuevos de regenerarVozParaGuion en el guion y en voz_url", async () => {
    vi.doMock("@/lib/crypto", () => ({ desencriptarSiHaceFalta: (v: string) => v }));
    vi.doMock("@/app/lib/videoOrganico/generarGuionConVoz", () => ({
      regenerarVozParaGuion: vi.fn(async () => ({
        ok: true,
        campos: { tiemposRender: [], palabrasPorEscena: [], segmentosAudio: [], narracionHash: "hash-nuevo", vozUrl: "https://x/voz-nueva.mp3" },
        puntajeAlineacion: 1,
        crudo: { palabrasPorEscenaCrudo: null, silencios: null },
      })),
    }));
    vi.resetModules();
    const { PATCH: PATCH2 } = await import("./route");
    const res = await PATCH2(patchReq({ accion: "regenerar_voz" }), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guion.vozUrl).toBe("https://x/voz-nueva.mp3");
    expect(updatesRealizados[0]).toMatchObject({ voz_url: "https://x/voz-nueva.mp3" });
    vi.doUnmock("@/lib/crypto");
    vi.doUnmock("@/app/lib/videoOrganico/generarGuionConVoz");
  });

  it("regenerarVozParaGuion encuentra hallazgos (narración rota tras editar): propaga el error, nunca actualiza", async () => {
    vi.doMock("@/lib/crypto", () => ({ desencriptarSiHaceFalta: (v: string) => v }));
    vi.doMock("@/app/lib/videoOrganico/generarGuionConVoz", () => ({
      regenerarVozParaGuion: vi.fn(async () => ({ ok: false, status: 400, error: "inconsistente", resumenErrores: ["e1: evento fuera de rango"] })),
    }));
    vi.resetModules();
    const { PATCH: PATCH2 } = await import("./route");
    const res = await PATCH2(patchReq({ accion: "regenerar_voz" }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
    vi.doUnmock("@/lib/crypto");
    vi.doUnmock("@/app/lib/videoOrganico/generarGuionConVoz");
  });
});

describe("PATCH /api/contenido/[id] -- guardar_calidad", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
    piezaActual = { id: "pieza-1", estado: "renderizando", guion: fixtureMitoVerdad, control_calidad: null };
  });

  it("solo mientras está renderizando: 400 si no", async () => {
    piezaActual = { ...piezaActual, estado: "aprobada" };
    const res = await PATCH(patchReq({ accion: "guardar_calidad", control_calidad: { aprobado: true } }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("guarda control_calidad sin cambiar de estado (recompactación a mitad de camino)", async () => {
    const res = await PATCH(patchReq({ accion: "guardar_calidad", guion: fixtureMitoVerdad }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).not.toMatchObject({ estado: expect.anything() });
  });

  it("estado:'error' pasa a error con tipo_error='calidad' y guarda los hallazgos", async () => {
    const res = await PATCH(patchReq({ accion: "guardar_calidad", estado: "error", control_calidad: { aprobado: false, hallazgos: ["x"] } }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).toMatchObject({ estado: "error", tipo_error: "calidad", control_calidad: { aprobado: false, hallazgos: ["x"] } });
  });
});

describe("PATCH /api/contenido/[id] -- forzar_sin_calidad / publicar_igual (nunca auto-publicable sin confirmar)", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
  });

  it("forzar_sin_calidad solo desde estado 'error'", async () => {
    piezaActual = { id: "pieza-1", estado: "aprobada", control_calidad: null };
    const res = await PATCH(patchReq({ accion: "forzar_sin_calidad" }), contexto());
    expect(res.status).toBe(400);
  });

  it("forzar_sin_calidad: vuelve a 'aprobada' con forzarSinCalidad:true (ColaDeRender se lo salta la próxima vuelta)", async () => {
    piezaActual = { id: "pieza-1", estado: "error", control_calidad: { aprobado: false, hallazgos: ["x"] } };
    const res = await PATCH(patchReq({ accion: "forzar_sin_calidad" }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).toMatchObject({ estado: "aprobada", control_calidad: { aprobado: false, hallazgos: ["x"], forzarSinCalidad: true } });
  });

  it("publicar_igual: rechaza si la pieza NO está marcada como forzada/no aprobada (ya está aprobada normal, no necesita esto)", async () => {
    piezaActual = { id: "pieza-1", estado: "lista", control_calidad: { aprobado: true } };
    const res = await PATCH(patchReq({ accion: "publicar_igual" }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("publicar_igual: pieza forzada y 'lista' -- recién ACÁ queda con publicarIgual:true (antes de este botón, el cron del paso 4 nunca la tomaría)", async () => {
    piezaActual = { id: "pieza-1", estado: "lista", control_calidad: { aprobado: false, forzado: true, hallazgos: ["x"] } };
    const res = await PATCH(patchReq({ accion: "publicar_igual" }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).toMatchObject({ control_calidad: { aprobado: false, forzado: true, hallazgos: ["x"], publicarIgual: true } });
  });

  it("publicar_igual: solo mientras está 'lista'", async () => {
    piezaActual = { id: "pieza-1", estado: "renderizando", control_calidad: { aprobado: false } };
    const res = await PATCH(patchReq({ accion: "publicar_igual" }), contexto());
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/contenido/[id] -- iniciar_render", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
  });

  it("aprobada: pasa a renderizando", async () => {
    const res = await PATCH(patchReq({ accion: "iniciar_render" }), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(updatesRealizados[0]).toMatchObject({ estado: "renderizando" });
  });

  it("otra pestaña ya la tomó (0 filas afectadas): 409", async () => {
    filasUpdateActual = [];
    const res = await PATCH(patchReq({ accion: "iniciar_render" }), contexto());
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/contenido/[id] -- reprogramar (arrastrar en el calendario)", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
    piezaActual = { id: "pieza-1", estado: "aprobada" };
  });

  function isoEnElFuturo(horas: number): string {
    return new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
  }
  function isoEnElPasado(horas: number): string {
    return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
  }

  it("fecha futura y estado reprogramable: mueve la pieza y recalcula la semana", async () => {
    const nuevaFecha = isoEnElFuturo(72);
    const res = await PATCH(patchReq({ accion: "reprogramar", programada_para: nuevaFecha }), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(updatesRealizados[0]).toMatchObject({ programada_para: nuevaFecha });
  });

  it("fecha pasada: 400, nunca llega a actualizar", async () => {
    const res = await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElPasado(24) }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("pieza ya publicada: 400, nunca se puede arrastrar", async () => {
    piezaActual = { id: "pieza-1", estado: "publicada" };
    const res = await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("otra pestaña cambió el estado mientras tanto (0 filas afectadas): 409", async () => {
    filasUpdateActual = [];
    const res = await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
    expect(res.status).toBe(409);
  });

  it("vencida sin video y sin estado previo guardado (vencida antes de la columna): vuelve a borrador", async () => {
    piezaActual = { id: "pieza-1", estado: "vencida", url_video: null, estado_antes_de_vencer: null };
    const res = await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).toMatchObject({ estado: "borrador", estado_antes_de_vencer: null });
  });

  it("vencida sin video que estaba en borrador: vuelve a borrador (nunca se salta la aprobación)", async () => {
    piezaActual = { id: "pieza-1", estado: "vencida", url_video: null, estado_antes_de_vencer: "borrador" };
    await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
    expect(updatesRealizados[0]).toMatchObject({ estado: "borrador" });
  });

  it("vencida sin video que ya estaba aprobada (o renderizando): vuelve a aprobada", async () => {
    for (const previo of ["aprobada", "renderizando"]) {
      updatesRealizados = [];
      piezaActual = { id: "pieza-1", estado: "vencida", url_video: null, estado_antes_de_vencer: previo };
      await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
      expect(updatesRealizados[0]).toMatchObject({ estado: "aprobada", estado_antes_de_vencer: null });
    }
  });

  it("vencida con video: vuelve a lista", async () => {
    piezaActual = { id: "pieza-1", estado: "vencida", url_video: "https://res.cloudinary.com/demo/video/upload/v1/r.mp4", estado_antes_de_vencer: "renderizando" };
    await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
    expect(updatesRealizados[0]).toMatchObject({ estado: "lista" });
  });

  it("estado no vencido: nunca cambia de estado, y siempre pone actualizado_en", async () => {
    piezaActual = { id: "pieza-1", estado: "lista", url_video: "x" };
    await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
    expect(updatesRealizados[0]).toMatchObject({ estado: "lista" });
    expect(updatesRealizados[0]).not.toHaveProperty("estado_antes_de_vencer");
    expect(typeof updatesRealizados[0].actualizado_en).toBe("string");
  });

  it("publicando, procesando, publicada o cancelada: 400, nunca se reprograma", async () => {
    for (const estado of ["publicando", "procesando", "publicada", "cancelada"]) {
      piezaActual = { id: "pieza-1", estado };
      const res = await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
      expect(res.status).toBe(400);
    }
    expect(updatesRealizados.length).toBe(0);
  });

  it("fecha inválida o hace un minuto: 400", async () => {
    for (const programada_para of ["no-es-fecha", new Date(Date.now() - 60 * 1000).toISOString(), undefined]) {
      const res = await PATCH(patchReq({ accion: "reprogramar", programada_para }), contexto());
      expect(res.status).toBe(400);
    }
    expect(updatesRealizados.length).toBe(0);
  });
});

describe("PATCH /api/contenido/[id] -- publicar_ahora (vencida con video)", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
    piezaActual = { id: "pieza-1", estado: "vencida", url_video: "https://res.cloudinary.com/demo/video/upload/v1/r.mp4", plataforma: "instagram" };
  });

  it("vuelve a 'lista' con la hora actual (dentro de la ventana del Publicador), sin tocar el control de calidad", async () => {
    const antes = Date.now();
    const res = await PATCH(patchReq({ accion: "publicar_ahora" }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).toMatchObject({ estado: "lista", estado_antes_de_vencer: null });
    expect(new Date(updatesRealizados[0].programada_para as string).getTime()).toBeGreaterThanOrEqual(antes);
    expect(updatesRealizados[0]).not.toHaveProperty("control_calidad");
  });

  it("sin video, de TikTok, o que no está vencida: 400", async () => {
    for (const extra of [{ url_video: null }, { plataforma: "tiktok" }, { estado: "lista" }, { estado: "publicada" }]) {
      piezaActual = { id: "pieza-1", estado: "vencida", url_video: "x", plataforma: "instagram", ...extra };
      const res = await PATCH(patchReq({ accion: "publicar_ahora" }), contexto());
      expect(res.status).toBe(400);
    }
    expect(updatesRealizados.length).toBe(0);
  });
});

describe("PATCH /api/contenido/[id] -- previa_eliminar / eliminar (borrado suave)", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    filasUpdateActual = [{ id: "pieza-1" }];
    updatesRealizados = [];
    partes2Actual = [];
    piezaActual = { id: "pieza-1", estado: "lista", tipo_error: null };
  });

  it("eliminar: pasa a 'cancelada' con actualizado_en, sin tocar el video ni el álbum", async () => {
    const res = await PATCH(patchReq({ accion: "eliminar" }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados).toHaveLength(1);
    expect(Object.keys(updatesRealizados[0]).sort()).toEqual(["actualizado_en", "estado"]);
    expect(updatesRealizados[0].estado).toBe("cancelada");
    expect(fromMock).not.toHaveBeenCalledWith("album_creativos");
  });

  it("se puede eliminar en cualquier estado previo a publicar (incluido error y vencida)", async () => {
    for (const estado of ["borrador", "generando", "aprobada", "renderizando", "lista", "error", "vencida"]) {
      updatesRealizados = [];
      piezaActual = { id: "pieza-1", estado };
      const res = await PATCH(patchReq({ accion: "eliminar" }), contexto());
      expect(res.status).toBe(200);
      expect(updatesRealizados[0]).toMatchObject({ estado: "cancelada" });
    }
  });

  it("publicando o procesando: 400 'Se está publicando en este momento', nunca actualiza", async () => {
    for (const estado of ["publicando", "procesando"]) {
      piezaActual = { id: "pieza-1", estado };
      for (const accion of ["previa_eliminar", "eliminar"]) {
        const res = await PATCH(patchReq({ accion }), contexto());
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe("Se está publicando en este momento.");
      }
    }
    expect(updatesRealizados.length).toBe(0);
  });

  it("ya cancelada: 400", async () => {
    piezaActual = { id: "pieza-1", estado: "cancelada" };
    const res = await PATCH(patchReq({ accion: "eliminar" }), contexto());
    expect(res.status).toBe(400);
  });

  it("el estado cambió mientras tanto (ej. el cron la reclamó): 409, no se cancela a ciegas", async () => {
    filasUpdateActual = [];
    const res = await PATCH(patchReq({ accion: "eliminar" }), contexto());
    expect(res.status).toBe(409);
  });

  it("previa: pieza normal -> '¿Eliminar este reel? No se publicará.', sin actualizar nada", async () => {
    const res = await PATCH(patchReq({ accion: "previa_eliminar" }), contexto());
    const body = await res.json();
    expect(body).toMatchObject({ tipo: "eliminar", titulo: "¿Eliminar este reel? No se publicará.", boton: "Eliminar" });
    expect(updatesRealizados.length).toBe(0);
  });

  it("previa: publicada -> 'Quitar del calendario', aclarando que no la borra de Instagram", async () => {
    piezaActual = { id: "pieza-1", estado: "publicada" };
    const body = await (await PATCH(patchReq({ accion: "previa_eliminar" }), contexto())).json();
    expect(body).toMatchObject({ tipo: "quitar_del_calendario", boton: "Quitar del calendario" });
    expect(body.detalles.join(" ")).toContain("no lo borra de Instagram");
  });

  it("previa: parte 1 de una serie con su parte 2 activa -> avisa que la parte 2 queda sin su anterior", async () => {
    partes2Actual = [{ id: "parte-2" }];
    const body = await (await PATCH(patchReq({ accion: "previa_eliminar" }), contexto())).json();
    expect(body.detalles.join(" ")).toContain("la parte 2 queda sin su anterior");
  });

  it("previa: error 'revisar_publicacion' -> pide revisar Instagram antes", async () => {
    piezaActual = { id: "pieza-1", estado: "error", tipo_error: "revisar_publicacion" };
    const body = await (await PATCH(patchReq({ accion: "previa_eliminar" }), contexto())).json();
    expect(body.detalles.join(" ")).toContain("Revisa tu Instagram");
  });
});

describe("PATCH /api/contenido/[id] -- tema", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    updatesRealizados = [];
  });

  it("guarda el tema mientras la pieza sigue en borrador", async () => {
    const res = await PATCH(patchReq({ accion: "tema", tema: "por qué tus anuncios no traen mensajes" }), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(updatesRealizados[0]).toMatchObject({ tema: "por qué tus anuncios no traen mensajes" });
  });

  it("tema vacío: lo guarda como null", async () => {
    const res = await PATCH(patchReq({ accion: "tema", tema: "   " }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).toMatchObject({ tema: null });
  });
});

describe("PATCH /api/contenido/[id] -- musica (elegir a mano, pedido explícito)", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    updatesRealizados = [];
    piezaActual = { id: "pieza-1", estado: "borrador", guion: fixtureMitoVerdad };
    pistaActual = { id: "33333333-3333-4333-8333-333333333333" };
  });

  it("admin elige una pista real: se guarda en guion.musica.pista_id", async () => {
    const res = await PATCH(patchReq({ accion: "musica", pista_id: "33333333-3333-4333-8333-333333333333" }), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((updatesRealizados[0].guion as { musica: { pista_id: string } }).musica.pista_id).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("admin puede elegir una pista SIN licencia (acá no se valida licencia, solo que exista) -- eso lo marca GET como 'solo pruebas'", async () => {
    const res = await PATCH(patchReq({ accion: "musica", pista_id: "33333333-3333-4333-8333-333333333333" }), contexto());
    expect(res.status).toBe(200);
  });

  it("pista_id que no existe: 400, nunca actualiza", async () => {
    pistaActual = null;
    const res = await PATCH(patchReq({ accion: "musica", pista_id: "no-existe" }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("pista_id null: quita la música (vuelve a 'sin música')", async () => {
    const res = await PATCH(patchReq({ accion: "musica", pista_id: null }), contexto());
    expect(res.status).toBe(200);
    expect((updatesRealizados[0].guion as { musica: { pista_id: string | null } }).musica.pista_id).toBe(null);
  });

  it("pieza sin guion todavía: 400", async () => {
    piezaActual = { id: "pieza-1", estado: "borrador", guion: null };
    const res = await PATCH(patchReq({ accion: "musica", pista_id: "33333333-3333-4333-8333-333333333333" }), contexto());
    expect(res.status).toBe(400);
  });

  it("pieza que ya no está en borrador: 400, no se puede cambiar la música después de aprobar", async () => {
    piezaActual = { id: "pieza-1", estado: "aprobada", guion: fixtureMitoVerdad };
    const res = await PATCH(patchReq({ accion: "musica", pista_id: "33333333-3333-4333-8333-333333333333" }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });
});

describe("PATCH /api/contenido/[id] -- editar", () => {
  beforeEach(() => {
    fromMock.mockClear();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    updatesRealizados = [];
  });

  it("guion inválido: 400, nunca actualiza", async () => {
    const res = await PATCH(patchReq({ accion: "editar", guion: { no: "es un guion" } }), contexto());
    expect(res.status).toBe(400);
    expect(updatesRealizados.length).toBe(0);
  });

  it("guion válido: guarda", async () => {
    const res = await PATCH(patchReq({ accion: "editar", guion: fixtureMitoVerdad, caption: "nuevo caption", hashtags: ["#x"] }), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(updatesRealizados[0]).toMatchObject({ caption: "nuevo caption", hashtags: ["#x"] });
  });
});
