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
    const obj = {
      select: () => {
        huboSelectTrasUpdate = true;
        return obj;
      },
      eq: () => obj,
      maybeSingle: async () => ({ data: piezaActual }),
      update: (valores: Record<string, unknown>) => {
        huboSelectTrasUpdate = false;
        updatesRealizados.push(valores);
        return obj;
      },
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
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

  it("pieza vencida: al reprogramarla vuelve a borrador (se revisa de nuevo antes de aprobar)", async () => {
    piezaActual = { id: "pieza-1", estado: "vencida" };
    const res = await PATCH(patchReq({ accion: "reprogramar", programada_para: isoEnElFuturo(24) }), contexto());
    expect(res.status).toBe(200);
    expect(updatesRealizados[0]).toMatchObject({ estado: "borrador" });
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
