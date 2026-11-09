// Prueba la capa TypeScript de GET/POST /api/productos con el cliente
// de Supabase mockeado -- nunca contra la base real. Cubre: listar
// activos/archivados, crear, el choque con el índice único de nombre
// (23505) traducido a un mensaje claro, y que marcar_uso (el flag que
// manda resolverProductoAlUsar en cada uso real) sí pone ultimo_uso_en
// al crear, mientras que crear desde "Mi marca" (sin ese flag) lo deja
// en null -- catalogar no es usar.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

function chain(data: unknown, error: unknown = null) {
  const obj: Record<string, unknown> = {
    select: () => obj,
    insert: (valores: unknown) => {
      insertadoCon = valores;
      return obj;
    },
    eq: () => obj,
    order: () => obj,
    in: () => obj,
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
    then: undefined,
  };
  return obj;
}

let insertadoCon: unknown = null;
let usuarioActual: Record<string, unknown> | null = null;
let productoCreadoActual: Record<string, unknown> | null = null;
let errorCreacionActual: { code?: string; message?: string } | null = null;
let productosListaActual: Record<string, unknown>[] = [];

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chain(usuarioActual);
  if (tabla === "productos") {
    // GET usa select().eq().eq().order().order() que resuelve como
    // promesa directamente (sin single/maybeSingle) -- se simula con
    // un objeto "thenable" que también sirve de query builder.
    type CadenaProductos = {
      __esConteo: boolean;
      select: (cols?: unknown, opts?: { count?: string; head?: boolean }) => CadenaProductos;
      insert: (valores: unknown) => CadenaProductos;
      eq: () => CadenaProductos;
      order: () => CadenaProductos;
      in: () => CadenaProductos;
      single: () => Promise<{ data: unknown; error: unknown }>;
      then: (resolve: (v: unknown) => unknown) => unknown;
    };
    const obj: CadenaProductos = {
      __esConteo: false,
      select: (_cols, opts) => {
        if (opts?.head) {
          obj.__esConteo = true;
        }
        return obj;
      },
      insert: (valores) => {
        insertadoCon = valores;
        return obj;
      },
      eq: () => obj,
      order: () => obj,
      in: () => obj,
      single: async () => ({ data: productoCreadoActual, error: errorCreacionActual }),
      then: (resolve) =>
        resolve(obj.__esConteo ? { count: productosListaActual.length, error: null } : { data: productosListaActual, error: null }),
    };
    return obj;
  }
  if (tabla === "album_creativos") {
    return { select: () => ({ in: async () => ({ data: [] }) }) };
  }
  throw new Error(`from("${String(tabla)}") no mockeado en este test`);
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}));

const registrarErrorMock = vi.fn();
vi.mock("@/lib/registrarError", () => ({ registrarError: (...args: unknown[]) => registrarErrorMock(...args) }));

const { GET, POST } = await import("./route");

const USUARIO_BASE = { id: "user-1" };

function getReq(url = "http://localhost/api/productos"): NextRequest {
  return new NextRequest(url);
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/productos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/productos", () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ user: { email: "cliente@quiubot.com" } });
    fromMock.mockClear();
    registrarErrorMock.mockReset();
    insertadoCon = null;
    usuarioActual = USUARIO_BASE;
    productoCreadoActual = null;
    errorCreacionActual = null;
    productosListaActual = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("GET", () => {
    it("rechaza sin sesión", async () => {
      authMock.mockResolvedValue(null);
      const res = await GET(getReq());
      expect(res.status).toBe(401);
    });

    it("lista los productos activos y manda archivadosCount", async () => {
      productosListaActual = [{ id: "p1", nombre: "Camiseta", album_ids: [] }];
      const res = await GET(getReq());
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.productos).toHaveLength(1);
      expect(typeof data.archivadosCount).toBe("number");
    });

    it("con ?archivados=1 no manda archivadosCount", async () => {
      const res = await GET(getReq("http://localhost/api/productos?archivados=1"));
      const data = await res.json();
      expect(data.archivadosCount).toBeUndefined();
    });
  });

  describe("POST", () => {
    const PRODUCTO_VALIDO = { tipo: "producto", nombre: "Camiseta Azul" };

    it("rechaza sin sesión", async () => {
      authMock.mockResolvedValue(null);
      const res = await POST(postReq(PRODUCTO_VALIDO));
      expect(res.status).toBe(401);
    });

    it("rechaza un cuerpo sin nombre", async () => {
      const res = await POST(postReq({ tipo: "producto" }));
      expect(res.status).toBe(400);
    });

    it("crea el producto y responde con la fila creada", async () => {
      productoCreadoActual = { id: "p1", nombre: "Camiseta Azul", tipo: "producto" };
      const res = await POST(postReq(PRODUCTO_VALIDO));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.producto).toEqual(productoCreadoActual);
    });

    it("creado desde 'Mi marca' (sin marcar_uso) deja ultimo_uso_en en null -- catalogar no es usar", async () => {
      productoCreadoActual = { id: "p1" };
      await POST(postReq(PRODUCTO_VALIDO));
      expect((insertadoCon as Record<string, unknown>).ultimo_uso_en).toBeNull();
    });

    it("creado con marcar_uso:true (uso real desde metas/estrategia/video) pone ultimo_uso_en a la fecha de hoy", async () => {
      productoCreadoActual = { id: "p1" };
      await POST(postReq({ ...PRODUCTO_VALIDO, marcar_uso: true }));
      expect((insertadoCon as Record<string, unknown>).ultimo_uso_en).not.toBeNull();
      expect(typeof (insertadoCon as Record<string, unknown>).ultimo_uso_en).toBe("string");
    });

    it("traduce el choque con el índice único de nombre (23505) a un mensaje claro, 409", async () => {
      errorCreacionActual = { code: "23505", message: "duplicate key value violates unique constraint" };
      const res = await POST(postReq(PRODUCTO_VALIDO));
      const data = await res.json();
      expect(res.status).toBe(409);
      expect(data.error).toBe("Ya tienes un producto con ese nombre.");
      expect(data.error).not.toContain("duplicate key");
    });

    it("cualquier otro error nunca muestra el texto crudo de Postgres, y lo registra con registrarError", async () => {
      errorCreacionActual = { code: "XX000", message: "algo interno de Postgres" };
      const res = await POST(postReq(PRODUCTO_VALIDO));
      const data = await res.json();
      expect(res.status).toBe(500);
      expect(data.error).not.toContain("Postgres");
      expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "crear_producto" }));
    });
  });
});
