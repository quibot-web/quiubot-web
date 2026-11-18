import { beforeEach, describe, expect, it, vi } from "vitest";

const analizarMock = vi.fn();
vi.mock("@/app/lib/analizarPiezaImagen", () => ({ analizarPiezaConOpenAI: (...a: unknown[]) => analizarMock(...a) }));

let pendientesEnBase: { id: string; url_imagen: string }[] = [];
const updates: { id: string; valores: Record<string, unknown> }[] = [];
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: () => {
      const q: Record<string, unknown> = {};
      let contar = false;
      Object.assign(q, {
        select: (_c: string, opciones?: { count?: string }) => ((contar = !!opciones?.count), q),
        eq: () => q,
        is: () => q,
        order: () => q,
        limit: async () => ({ data: pendientesEnBase }),
        update: (valores: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updates.push({ id, valores });
            pendientesEnBase = pendientesEnBase.filter((p) => p.id !== id);
            return { error: null };
          },
        }),
        then: (resolve: (v: unknown) => void) => resolve(contar ? { count: pendientesEnBase.length } : { data: pendientesEnBase }),
      });
      return q;
    },
  },
}));
vi.mock("@/lib/crypto", () => ({ desencriptarSiHaceFalta: (v: string) => v }));

import { analizarPendientes, aptaParaFondo } from "./analisisAlbum";

const ANALISIS = { version: 1, tiene_texto: false, es_publicitaria: false, fondo_limpio: true, recuadro_producto: null };

describe("análisis del álbum", () => {
  beforeEach(() => {
    analizarMock.mockReset();
    updates.length = 0;
  });

  it("apta para fondo solo si está analizada y no tiene texto", () => {
    expect(aptaParaFondo({ tiene_texto: false })).toBe(true);
    expect(aptaParaFondo({ tiene_texto: true })).toBe(false);
    expect(aptaParaFondo(null)).toBe(false);
  });

  it("lote: una imagen que falla no detiene las demás; guarda las que salen bien y cuenta lo pendiente", async () => {
    pendientesEnBase = [
      { id: "a", url_imagen: "https://x/a.jpg" },
      { id: "b", url_imagen: "https://x/b.jpg" },
      { id: "c", url_imagen: "https://x/c.jpg" },
    ];
    analizarMock.mockResolvedValueOnce(ANALISIS).mockRejectedValueOnce(new Error("OpenAI 500")).mockResolvedValueOnce({ ...ANALISIS, tiene_texto: true });
    const r = await analizarPendientes("u1", "sk-test", 4);
    expect(r).toEqual({ analizadas: 2, fallidas: 1, pendientes: 1 });
    expect(updates.map((u) => u.id)).toEqual(["a", "c"]);
    expect(updates[0].valores.analisis).toEqual(ANALISIS);
  });
});
