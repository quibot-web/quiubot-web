// Prueba GET/POST /api/contenido (calendario semanal, commit 4a) con
// Supabase mockeado -- nunca contra la base real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { lunesDeLaSemana } from "@/app/lib/contenido";
import { fechaBogota } from "@/app/lib/fechaBogota";

// Relativa a "ahora" (nunca una fecha fija como "2026-11-20") -- esta
// prueba tiene que seguir pasando sin importar qué día se corra de
// verdad, por la validación nueva de "la fecha/hora deben ser futuras".
function isoEnElFuturo(horas: number): string {
  return new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
}
function isoEnElPasado(horas: number): string {
  return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
}

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

let usuarioActual: Record<string, unknown> | null = null;
let piezasSemanaActual: Record<string, unknown>[] = [];
let piezaCreadaActual: Record<string, unknown> | null = null;
let errorInsertActual: { message: string } | null = null;
let insertadoCon: Record<string, unknown> | null = null;

function chainUsuarios(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }) };
  return obj;
}

type CadenaPiezas = {
  select: () => CadenaPiezas;
  eq: () => CadenaPiezas;
  order: () => Promise<{ data: unknown; error: unknown }>;
  insert: (valores: Record<string, unknown>) => CadenaPiezas;
  single: () => Promise<{ data: unknown; error: unknown }>;
};

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainUsuarios(usuarioActual);
  if (tabla === "publicaciones_organicas") {
    const obj: CadenaPiezas = {
      select: () => obj,
      eq: () => obj,
      order: async () => ({ data: piezasSemanaActual, error: null }),
      insert: (valores) => {
        insertadoCon = valores;
        return obj;
      },
      single: async () => (errorInsertActual ? { data: null, error: errorInsertActual } : { data: piezaCreadaActual, error: null }),
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

const { GET, POST } = await import("./route");

const USUARIO_ADMIN = { id: "user-1", rol: "admin" };

function getReq(semana?: string): NextRequest {
  const url = semana ? `http://localhost/api/contenido?semana=${semana}` : "http://localhost/api/contenido";
  return new NextRequest(url);
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/contenido", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

describe("GET /api/contenido", () => {
  beforeEach(() => {
    fromMock.mockClear();
    registrarErrorMock.mockReset();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    piezasSemanaActual = [{ id: "pieza-1", estado: "borrador" }];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sin sesión: 401", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("no admin: 403", async () => {
    usuarioActual = { id: "user-1", rol: "cliente" };
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("sin ?semana: usa la semana de hoy y devuelve las piezas", async () => {
    const res = await GET(getReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.piezas).toEqual(piezasSemanaActual);
    expect(typeof body.semana).toBe("string");
  });

  it("?semana= cualquier día de la semana -- siempre normaliza al lunes", async () => {
    const res = await GET(getReq("2026-11-11")); // miércoles
    const body = await res.json();
    expect(body.semana).toBe("2026-11-09");
  });
});

describe("POST /api/contenido (agregar reel a mano)", () => {
  beforeEach(() => {
    fromMock.mockClear();
    registrarErrorMock.mockReset();
    authMock.mockResolvedValue({ user: { email: "marca@quiubot.com" } });
    usuarioActual = USUARIO_ADMIN;
    insertadoCon = null;
    errorInsertActual = null;
    piezaCreadaActual = { id: "pieza-nueva", estado: "borrador" };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("crea la pieza en borrador con la semana calculada de programada_para", async () => {
    const programadaPara = isoEnElFuturo(48);
    const res = await POST(postReq({ receta_organica: "mito_verdad", programada_para: programadaPara }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(insertadoCon).toMatchObject({
      user_id: "user-1",
      plataforma: "instagram",
      receta_organica: "mito_verdad",
      estado: "borrador",
      semana: lunesDeLaSemana(fechaBogota(new Date(programadaPara))),
    });
    expect(body.pieza).toEqual(piezaCreadaActual);
  });

  it("guarda media_ids cuando se eligieron piezas del álbum", async () => {
    await POST(
      postReq({
        receta_organica: "producto_en_uso",
        programada_para: isoEnElFuturo(48),
        media_ids: ["11111111-1111-4111-8111-111111111111"],
      })
    );
    expect(insertadoCon).toMatchObject({ media_ids: ["11111111-1111-4111-8111-111111111111"] });
  });

  it("producto_en_uso sin piezas: 400, nunca llega a insertar", async () => {
    const res = await POST(postReq({ receta_organica: "producto_en_uso", programada_para: isoEnElFuturo(48) }));
    expect(res.status).toBe(400);
    expect(insertadoCon).toBeNull();
  });

  it("rechaza una receta_organica que no existe: 400, nunca llega a insertar", async () => {
    const res = await POST(postReq({ receta_organica: "no_existe", programada_para: isoEnElFuturo(48) }));
    expect(res.status).toBe(400);
    expect(insertadoCon).toBeNull();
  });

  it("rechaza una fecha/hora ya pasada: 400, nunca llega a insertar (caso real que motivó esto)", async () => {
    const res = await POST(postReq({ receta_organica: "mito_verdad", programada_para: isoEnElPasado(5 * 24) }));
    expect(res.status).toBe(400);
    expect(insertadoCon).toBeNull();
  });

  it("si Supabase falla al insertar: 503 y se registra el error", async () => {
    errorInsertActual = { message: "boom" };
    const res = await POST(postReq({ receta_organica: "mito_verdad", programada_para: isoEnElFuturo(48) }));
    expect(res.status).toBe(503);
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "contenido_calendario" }));
  });
});
