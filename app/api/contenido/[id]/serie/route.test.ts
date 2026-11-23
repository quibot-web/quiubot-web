// POST /api/contenido/[id]/serie con Supabase simulado -- nunca contra la base real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => authMock(...a) }));

let pieza: Record<string, unknown> | null;
let actualizaciones: Record<string, unknown>[];
let inserciones: Record<string, unknown>[];

function consulta(tabla: string) {
  const filtros: Record<string, unknown> = {};
  let operacion: "select" | "update" | "insert" = "select";
  let datos: Record<string, unknown> = {};
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => {
      filtros[c] = v;
      return q;
    },
    update: (d: Record<string, unknown>) => {
      operacion = "update";
      datos = d;
      return q;
    },
    insert: (d: Record<string, unknown>) => {
      operacion = "insert";
      datos = d;
      return q;
    },
    single: async () => {
      if (tabla === "usuarios") return { data: { id: "u1", rol: "admin" } };
      if (operacion === "insert") {
        const fila = { ...datos, id: `nueva-${inserciones.length + 1}` };
        inserciones.push(fila);
        return { data: fila, error: null };
      }
      return { data: null };
    },
    maybeSingle: async () => ({ data: pieza }),
    then: (resolver: (v: unknown) => void) => {
      if (operacion === "update") actualizaciones.push({ ...datos, filtros: { ...filtros } });
      resolver({ data: tabla === "publicaciones_organicas" && operacion === "select" ? [] : null, error: null });
    },
  };
  return q;
}
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: (t: string) => consulta(t) } }));

const { POST } = await import("./route");

const manana = (dias: number) => new Date(Date.now() + dias * 86400e3).toISOString();
const req = (cuerpo: unknown) => new NextRequest("http://x/api/contenido/p1/serie", { method: "POST", body: JSON.stringify(cuerpo) });
const ctx = { params: Promise.resolve({ id: "p1" }) };

describe("POST /api/contenido/[id]/serie", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { email: "admin@quiubot.com" } });
    pieza = { id: "p1", estado: "borrador", receta_organica: "consejos_numerados", producto_id: null, media_ids: null, plataforma: "instagram" };
    actualizaciones = [];
    inserciones = [];
  });

  it("la parte 1 queda en esta pieza y las demás se crean en borrador, cada una con su fecha y enlazada a la anterior", async () => {
    const res = await POST(req({ partes: [{ idea: "Parte 1 de 3. uno", programada_para: manana(1) }, { idea: "Parte 2 de 3. dos", programada_para: manana(2) }, { idea: "Parte 3 de 3. tres", programada_para: manana(3) }] }), ctx);
    expect(res.status).toBe(201);
    expect(actualizaciones[0]).toMatchObject({ tema: "Parte 1 de 3. uno" });
    expect(inserciones).toHaveLength(2);
    expect(inserciones[0]).toMatchObject({ tema: "Parte 2 de 3. dos", estado: "borrador", continua_de_id: "p1", receta_organica: "consejos_numerados" });
    expect(inserciones[1]).toMatchObject({ tema: "Parte 3 de 3. tres", continua_de_id: "nueva-1" });
  });

  it("cada parte lleva 'Parte k de N.' al comienzo de su idea (si la propuesta no lo traía)", async () => {
    const res = await POST(req({ partes: [{ idea: "botón y conexión", programada_para: manana(1) }, { idea: "responder rápido", programada_para: manana(2) }] }), ctx);
    expect(res.status).toBe(201);
    expect(actualizaciones[0]).toMatchObject({ tema: "Parte 1 de 2.\nbotón y conexión" });
    expect(inserciones[0]).toMatchObject({ tema: "Parte 2 de 2.\nresponder rápido" });
  });

  it("rechaza fechas pasadas, menos de 2 o más de 3 partes, y piezas que ya no están en borrador", async () => {
    expect((await POST(req({ partes: [{ idea: "uno uno", programada_para: manana(-1) }, { idea: "dos dos", programada_para: manana(2) }] }), ctx)).status).toBe(400);
    expect((await POST(req({ partes: [{ idea: "uno uno", programada_para: manana(1) }] }), ctx)).status).toBe(400);
    expect((await POST(req({ partes: Array.from({ length: 4 }, (_, i) => ({ idea: `parte ${i}`, programada_para: manana(i + 1) })) }), ctx)).status).toBe(400);
    pieza = { ...pieza, estado: "aprobada" };
    expect((await POST(req({ partes: [{ idea: "uno uno", programada_para: manana(1) }, { idea: "dos dos", programada_para: manana(2) }] }), ctx)).status).toBe(400);
    expect(inserciones).toHaveLength(0);
  });
});
