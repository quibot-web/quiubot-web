// Prueba GET/PATCH /api/contenido/[id] (detalle, editar, aprobar) con
// Supabase mockeado -- nunca contra la base real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fixtureMitoVerdad } from "@/video/fixtures/organico/mitoVerdad";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

let usuarioActual: Record<string, unknown> | null = null;
let piezaActual: Record<string, unknown> | null = null;
let filasUpdateActual: { id: string }[] | null = [{ id: "pieza-1" }];
let updatesRealizados: Record<string, unknown>[] = [];

function chainUsuarios(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }) };
  return obj;
}

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainUsuarios(usuarioActual);
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
    piezaActual = { id: "pieza-1", estado: "borrador", guion: null };
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

  it("devuelve la pieza", async () => {
    const res = await GET(getReq(), contexto());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pieza).toEqual(piezaActual);
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
