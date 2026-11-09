// Prueba la capa TypeScript de PATCH /api/productos/[id] con el
// cliente de Supabase mockeado -- nunca contra la base real. Cubre:
// editar, archivar (activo:false -- nunca se borra de verdad), el
// choque con el índice único de nombre (23505), y marcar_uso (el flag
// que resolverProductoAlUsar manda en cada uso real, para que
// ultimo_uso_en se actualice aunque no se edite nada más).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

let usuarioActual: Record<string, unknown> | null = null;
let productoActualizadoActual: Record<string, unknown> | null = null;
let errorActualizacionActual: { code?: string; message?: string } | null = null;
let actualizadoCon: Record<string, unknown> | null = null;

function chainUsuarios(data: unknown) {
  const obj = { select: () => obj, eq: () => obj, single: async () => ({ data, error: null }) };
  return obj;
}

type CadenaProductos = {
  update: (valores: Record<string, unknown>) => CadenaProductos;
  eq: () => CadenaProductos;
  select: () => CadenaProductos;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
};

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chainUsuarios(usuarioActual);
  if (tabla === "productos") {
    const obj: CadenaProductos = {
      update: (valores) => {
        actualizadoCon = valores;
        return obj;
      },
      eq: () => obj,
      select: () => obj,
      maybeSingle: async () => ({ data: productoActualizadoActual, error: errorActualizacionActual }),
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

const { PATCH } = await import("./route");

const USUARIO_BASE = { id: "user-1" };

function patchReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/productos/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function llamar(body: unknown) {
  return PATCH(patchReq(body), { params: Promise.resolve({ id: "p1" }) });
}

describe("PATCH /api/productos/[id]", () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ user: { email: "cliente@quiubot.com" } });
    fromMock.mockClear();
    registrarErrorMock.mockReset();
    usuarioActual = USUARIO_BASE;
    productoActualizadoActual = { id: "p1", nombre: "Camiseta Azul" };
    errorActualizacionActual = null;
    actualizadoCon = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rechaza sin sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await llamar({ nombre: "Nueva" });
    expect(res.status).toBe(401);
  });

  it("cuerpo vacío (sin marcar_uso) no actualiza nada, 400", async () => {
    const res = await llamar({});
    expect(res.status).toBe(400);
  });

  it("marcar_uso solo (sin ningún otro campo) sí cuenta como actualización válida", async () => {
    const res = await llamar({ marcar_uso: true });
    expect(res.status).toBe(200);
    expect((actualizadoCon as Record<string, unknown>).ultimo_uso_en).toBeTruthy();
  });

  it("marcar_uso nunca se filtra como columna -- solo dispara ultimo_uso_en", async () => {
    await llamar({ marcar_uso: true });
    expect(actualizadoCon).not.toHaveProperty("marcar_uso");
  });

  it("editar precio/destacar sin marcar_uso no toca ultimo_uso_en", async () => {
    await llamar({ precio_cop: 50000, destacar: "Envío gratis" });
    expect(actualizadoCon).not.toHaveProperty("ultimo_uso_en");
    expect((actualizadoCon as Record<string, unknown>).precio_cop).toBe(50000);
  });

  it("editar precio/destacar CON marcar_uso actualiza ambos a la vez", async () => {
    await llamar({ precio_cop: 60000, marcar_uso: true });
    expect((actualizadoCon as Record<string, unknown>).precio_cop).toBe(60000);
    expect((actualizadoCon as Record<string, unknown>).ultimo_uso_en).toBeTruthy();
  });

  it("archivar es activo:false -- nunca se borra de verdad", async () => {
    const res = await llamar({ activo: false });
    expect(res.status).toBe(200);
    expect((actualizadoCon as Record<string, unknown>).activo).toBe(false);
  });

  it("restaurar un archivado es activo:true", async () => {
    await llamar({ activo: true });
    expect((actualizadoCon as Record<string, unknown>).activo).toBe(true);
  });

  it("producto no encontrado (o no es de este usuario) responde 404", async () => {
    productoActualizadoActual = null;
    const res = await llamar({ nombre: "Otra cosa" });
    expect(res.status).toBe(404);
  });

  it("traduce el choque con el índice único de nombre (23505) a un mensaje claro, 409", async () => {
    errorActualizacionActual = { code: "23505", message: "duplicate key value violates unique constraint" };
    const res = await llamar({ nombre: "Ya existe" });
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe("Ya tienes un producto con ese nombre.");
  });

  it("cualquier otro error nunca muestra el texto crudo de Postgres, y lo registra con registrarError", async () => {
    errorActualizacionActual = { code: "XX000", message: "algo interno de Postgres" };
    const res = await llamar({ nombre: "Lo que sea" });
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).not.toContain("Postgres");
    expect(registrarErrorMock).toHaveBeenCalledWith(expect.objectContaining({ origen: "actualizar_producto" }));
  });
});
