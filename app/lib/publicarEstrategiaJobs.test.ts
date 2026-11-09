// Prueba procesarPublicarEstrategia con Supabase y fetch (n8n)
// mockeados -- nunca contra la base real ni contra n8n de verdad.
// Cubre específicamente la copia de datos del producto que queda en
// campanas_publicadas: producto_id se valida contra el usuario (mismo
// patrón que meta_id) antes de guardarlo, y datos_producto/
// tipo_contenido siguen siendo la foto de texto de siempre.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { procesarPublicarEstrategia } from "./publicarEstrategiaJobs";

let trabajoInicial: Record<string, unknown>;
let resultadoTrasUpdate: Record<string, unknown> | null = null;
let productoDelUsuarioActual: { id: string } | null = null;
let campanaInsertadaCon: Record<string, unknown> | null = null;

type CadenaTrabajos = {
  select: () => CadenaTrabajos;
  eq: () => CadenaTrabajos;
  update: (valores: Record<string, unknown>) => CadenaTrabajos;
  single: () => Promise<{ data: unknown }>;
};

function chainTrabajos(): CadenaTrabajos {
  const obj: CadenaTrabajos = {
    select: () => obj,
    eq: () => obj,
    update: (valores) => {
      if (valores.resultado) resultadoTrasUpdate = valores.resultado as Record<string, unknown>;
      return obj;
    },
    single: async () => (resultadoTrasUpdate ? { data: { resultado: resultadoTrasUpdate } } : { data: trabajoInicial }),
  };
  return obj;
}

const fromMock = vi.fn();
fromMock.mockImplementation((tabla: unknown) => {
  if (tabla === "trabajos_ia") return chainTrabajos();
  if (tabla === "productos") {
    return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: productoDelUsuarioActual }) }) }) }) };
  }
  if (tabla === "campanas_publicadas") {
    return {
      insert: (valores: Record<string, unknown>) => {
        campanaInsertadaCon = valores;
        return {
          select: () => ({ single: async () => ({ data: { id: "camp-1", nombre: "Campaña de prueba" }, error: null }) }),
        };
      },
    };
  }
  if (tabla === "notificaciones") return { insert: async () => ({}) };
  throw new Error(`from("${String(tabla)}") no mockeado en este test`);
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}));

const registrarErrorMock = vi.fn();
vi.mock("@/lib/registrarError", () => ({ registrarError: (...args: unknown[]) => registrarErrorMock(...args) }));

const fetchMock = vi.fn();

const DATOS_BASE = {
  emailBusqueda: "cliente@quiubot.com",
  userId: "user-1",
  estrategia: { campana: { nombre: "Campaña de prueba", objetivo_id: "leads" } },
  creativos: [],
  fuenteCreativos: "imagen",
  efectividadFinal: null,
  instagram: null,
  metaId: null,
  tipoContenido: "producto",
  descripcionServicio: null,
  datosProducto: "Camiseta Azul. Envío gratis",
  productoId: null as string | null,
};

describe("procesarPublicarEstrategia -- copia de datos en campanas_publicadas", () => {
  beforeEach(() => {
    fromMock.mockClear();
    registrarErrorMock.mockReset();
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ meta_campaign_id: "mc-1", meta_adset_id: "ms-1" }) });
    vi.stubGlobal("fetch", fetchMock);
    trabajoInicial = { id: "job-1", estado: "pendiente", resultado: null };
    resultadoTrasUpdate = null;
    productoDelUsuarioActual = null;
    campanaInsertadaCon = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("producto_id de verdad del usuario: se valida y queda guardado en campanas_publicadas", async () => {
    productoDelUsuarioActual = { id: "prod-1" };
    await procesarPublicarEstrategia("job-1", { ...DATOS_BASE, productoId: "prod-1" });

    expect(campanaInsertadaCon).toMatchObject({
      producto_id: "prod-1",
      tipo_contenido: "producto",
      datos_producto: "Camiseta Azul. Envío gratis",
    });
  });

  it("producto_id que no es de este usuario (o no existe): nunca se guarda, pero la campaña se publica igual", async () => {
    productoDelUsuarioActual = null; // maybeSingle no encuentra nada con ese id+user_id
    await procesarPublicarEstrategia("job-1", { ...DATOS_BASE, productoId: "prod-ajeno" });

    expect(campanaInsertadaCon).toMatchObject({ producto_id: null });
  });

  it("sin producto_id (campañas/flujos que no usan catálogo): producto_id null, sin romper nada", async () => {
    await procesarPublicarEstrategia("job-1", { ...DATOS_BASE, productoId: null });
    expect(campanaInsertadaCon).toMatchObject({ producto_id: null });
    expect(fromMock).not.toHaveBeenCalledWith("productos");
  });

  it("si el trabajo ya no está pendiente (otro proceso lo tomó), no hace nada", async () => {
    trabajoInicial = { id: "job-1", estado: "procesando", resultado: null };
    await procesarPublicarEstrategia("job-1", DATOS_BASE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(campanaInsertadaCon).toBeNull();
  });
});
