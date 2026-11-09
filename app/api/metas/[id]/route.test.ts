// Prueba la capa TypeScript de PATCH /api/metas/[id] con el cliente de
// Supabase mockeado -- nunca contra la base real. Cubre: los 3 cambios
// posibles (pausar/reanudar, cancelar, editar presupuesto) armando el
// tipo_evento y el mensaje del Director correctos, que editar
// presupuesto revalida contra lo ya gastado (calcularAvanceMeta) antes
// de llamar a cambiarEstadoMeta, y que "meta no encontrada" y "ya no
// está activa" devuelven el mismo 404 de siempre.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

function chain(data: unknown, error: unknown = null) {
  const obj = {
    select: () => obj,
    eq: () => obj,
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
  };
  return obj;
}

let usuarioActual: Record<string, unknown> | null = null;
let metaExistenteActual: Record<string, unknown> | null = null;
const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "usuarios") return chain(usuarioActual);
  if (tabla === "metas") return chain(metaExistenteActual);
  throw new Error(`from("${String(tabla)}") no mockeado en este test`);
});
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}));

const cambiarEstadoMetaMock = vi.fn();
const calcularAvanceMetaMock = vi.fn();
vi.mock("@/app/lib/metas", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/app/lib/metas")>();
  return {
    ...real,
    cambiarEstadoMeta: (...args: unknown[]) => cambiarEstadoMetaMock(...args),
    calcularAvanceMeta: (...args: unknown[]) => calcularAvanceMetaMock(...args),
  };
});

const { PATCH } = await import("./route");

const USUARIO_BASE = { id: "user-1", rol: "admin" };
const META_BASE = {
  id: "meta-1",
  user_id: "user-1",
  tipo: "leads",
  estado: "activa",
  cantidad_objetivo: 50,
  fecha_inicio: "2026-01-01",
  fecha_fin: "2026-12-31",
  presupuesto_maximo_cop: 500000,
  valor_inicial: null,
};

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/metas/meta-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patch(body: unknown) {
  return PATCH(req(body), { params: Promise.resolve({ id: "meta-1" }) });
}

describe("PATCH /api/metas/[id]", () => {
  beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ user: { email: "cliente@quiubot.com" } });
    fromMock.mockClear();
    cambiarEstadoMetaMock.mockReset();
    calcularAvanceMetaMock.mockReset();
    usuarioActual = { ...USUARIO_BASE };
    metaExistenteActual = { ...META_BASE };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("404 si la meta no existe para este usuario -- nunca llama a cambiarEstadoMeta", async () => {
    metaExistenteActual = null;
    const res = await patch({ pausado_autopiloto: true });
    expect(res.status).toBe(404);
    expect(cambiarEstadoMetaMock).not.toHaveBeenCalled();
  });

  it("400 si el body no trae ningún campo reconocido", async () => {
    const res = await patch({ algo: "raro" });
    expect(res.status).toBe(400);
    expect(cambiarEstadoMetaMock).not.toHaveBeenCalled();
  });

  it("pausar: tipo_evento meta_pausada, pausadoAutopiloto true, mensaje menciona el tipo", async () => {
    cambiarEstadoMetaMock.mockResolvedValue({ ...META_BASE, pausado_autopiloto: true });
    const res = await patch({ pausado_autopiloto: true });

    expect(res.status).toBe(200);
    expect(cambiarEstadoMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({ metaId: "meta-1", userId: "user-1", tipoEvento: "meta_pausada", pausadoAutopiloto: true })
    );
    const llamada = cambiarEstadoMetaMock.mock.calls[0][0];
    expect(llamada.mensajeDirector).toContain("leads");
  });

  it("reanudar: tipo_evento meta_reanudada, pausadoAutopiloto false", async () => {
    cambiarEstadoMetaMock.mockResolvedValue({ ...META_BASE, pausado_autopiloto: false });
    await patch({ pausado_autopiloto: false });
    expect(cambiarEstadoMetaMock).toHaveBeenCalledWith(expect.objectContaining({ tipoEvento: "meta_reanudada", pausadoAutopiloto: false }));
  });

  it("cancelar: tipo_evento meta_cancelada, estadoNuevo cancelada", async () => {
    cambiarEstadoMetaMock.mockResolvedValue({ ...META_BASE, estado: "cancelada" });
    await patch({ estado: "cancelada" });
    expect(cambiarEstadoMetaMock).toHaveBeenCalledWith(expect.objectContaining({ tipoEvento: "meta_cancelada", estadoNuevo: "cancelada" }));
  });

  it("404 cuando cambiarEstadoMeta devuelve null (ya no estaba activa)", async () => {
    cambiarEstadoMetaMock.mockResolvedValue(null);
    const res = await patch({ estado: "cancelada" });
    expect(res.status).toBe(404);
  });

  it("500 cuando cambiarEstadoMeta lanza (error real de la RPC)", async () => {
    cambiarEstadoMetaMock.mockRejectedValue(new Error("boom"));
    const res = await patch({ estado: "cancelada" });
    expect(res.status).toBe(500);
  });

  it("editar presupuesto: rechaza un valor <= 0 sin calcular avance ni llamar a cambiarEstadoMeta", async () => {
    const res = await patch({ presupuesto_maximo_cop: 0 });
    expect(res.status).toBe(400);
    expect(calcularAvanceMetaMock).not.toHaveBeenCalled();
    expect(cambiarEstadoMetaMock).not.toHaveBeenCalled();
  });

  it("editar presupuesto: rechaza un valor menor a lo ya gastado, sin llamar a cambiarEstadoMeta", async () => {
    calcularAvanceMetaMock.mockResolvedValue({ spend: 300000, conversiones: 10, diasRestantes: 20, proyeccion: null });

    const res = await patch({ presupuesto_maximo_cop: 200000 });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("gastaste");
    expect(cambiarEstadoMetaMock).not.toHaveBeenCalled();
  });

  it("editar presupuesto: lo acepta cuando es mayor o igual a lo gastado, con detalle del cambio", async () => {
    calcularAvanceMetaMock.mockResolvedValue({ spend: 300000, conversiones: 10, diasRestantes: 20, proyeccion: null });
    cambiarEstadoMetaMock.mockResolvedValue({ ...META_BASE, presupuesto_maximo_cop: 400000 });

    const res = await patch({ presupuesto_maximo_cop: 400000 });

    expect(res.status).toBe(200);
    expect(cambiarEstadoMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoEvento: "presupuesto_actualizado",
        presupuestoMaximoCop: 400000,
        detalle: { presupuesto_anterior: 500000, presupuesto_nuevo: 400000 },
      })
    );
  });

  it("editar presupuesto: acepta un valor exactamente igual a lo gastado (el límite no es gastar de más)", async () => {
    calcularAvanceMetaMock.mockResolvedValue({ spend: 300000, conversiones: 10, diasRestantes: 20, proyeccion: null });
    cambiarEstadoMetaMock.mockResolvedValue({ ...META_BASE, presupuesto_maximo_cop: 300000 });

    const res = await patch({ presupuesto_maximo_cop: 300000 });
    expect(res.status).toBe(200);
  });
});
