// Alcance deliberadamente acotado: solo cambiarEstadoMeta(), la capa
// delgada sobre la RPC cambiar_estado_meta (docs/sql/metas_atomicas.sql)
// que ahora usan PATCH /api/metas/[id] y cerrarMetasVencidas(). El resto
// de app/lib/metas.ts (calcularAvanceMeta, verificarRequisitosMeta, etc.)
// queda para una ronda de tests aparte -- esto cubre específicamente la
// pieza nueva de la sincronización Metas↔Director.
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { cambiarEstadoMeta } from "./metas";

describe("cambiarEstadoMeta", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("manda los p_* con los opcionales ausentes en null/{} -- nunca undefined", async () => {
    rpcMock.mockResolvedValue({ data: { id: "meta-1", estado: "activa" }, error: null });

    await cambiarEstadoMeta({ metaId: "meta-1", userId: "user-1", tipoEvento: "meta_pausada", pausadoAutopiloto: true });

    expect(rpcMock).toHaveBeenCalledWith("cambiar_estado_meta", {
      p_meta_id: "meta-1",
      p_user_id: "user-1",
      p_tipo_evento: "meta_pausada",
      p_pausado_autopiloto: true,
      p_estado_nuevo: null,
      p_presupuesto_maximo_cop: null,
      p_detalle: {},
      p_mensaje_director: null,
    });
  });

  it("pasa estado_nuevo, presupuesto, detalle y mensaje cuando vienen", async () => {
    rpcMock.mockResolvedValue({ data: { id: "meta-1" }, error: null });

    await cambiarEstadoMeta({
      metaId: "meta-1",
      userId: "user-1",
      tipoEvento: "presupuesto_actualizado",
      presupuestoMaximoCop: 500000,
      detalle: { presupuesto_anterior: 300000 },
      mensajeDirector: "Actualicé el presupuesto.",
    });

    expect(rpcMock).toHaveBeenCalledWith("cambiar_estado_meta", {
      p_meta_id: "meta-1",
      p_user_id: "user-1",
      p_tipo_evento: "presupuesto_actualizado",
      p_pausado_autopiloto: null,
      p_estado_nuevo: null,
      p_presupuesto_maximo_cop: 500000,
      p_detalle: { presupuesto_anterior: 300000 },
      p_mensaje_director: "Actualicé el presupuesto.",
    });
  });

  it("devuelve null cuando la RPC devuelve data null (meta no encontrada o ya no activa)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const resultado = await cambiarEstadoMeta({ metaId: "meta-1", userId: "user-1", tipoEvento: "meta_cancelada", estadoNuevo: "cancelada" });

    expect(resultado).toBeNull();
  });

  it("lanza (nunca devuelve null en silencio) cuando la RPC devuelve un error real de Postgres", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });

    await expect(cambiarEstadoMeta({ metaId: "meta-1", userId: "user-1", tipoEvento: "meta_cancelada", estadoNuevo: "cancelada" })).rejects.toMatchObject({
      code: "XX000",
    });
  });
});
