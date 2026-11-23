import { describe, expect, it, vi } from "vitest";
import { generarPlanIlustrado, planTrasRegenerarVoz } from "./generarPlanIlustrado";

const ESCENAS = [
  { id: "e1", narracion: "Pagas anuncios y nadie te compra hoy" },
  { id: "e2", narracion: "Cada vez que pasa se te va una moneda" },
];
const VALIDO = {
  frases: [
    { escena_id: "e1", acciones: [{ escena: "feed", accion: "aparece_anuncio", palabra: 1 }, { escena: "feed", accion: "desliza", palabra: 4 }] },
    { escena_id: "e2", acciones: [{ escena: "billetera", accion: "sale_moneda", palabra: 3 }, { escena: "billetera", accion: "sale_moneda", palabra: 7 }] },
  ],
};
const INVALIDO = { frases: [{ escena_id: "e1", acciones: [{ escena: "feed", accion: "vuela", palabra: 0 }] }] };

describe("generarPlanIlustrado", () => {
  it("si el primer intento falla, reintenta con los problemas en el prompt y acepta el segundo", async () => {
    const llamar = vi.fn().mockResolvedValueOnce(JSON.stringify(INVALIDO)).mockResolvedValueOnce(JSON.stringify(VALIDO));
    const r = await generarPlanIlustrado(ESCENAS, llamar);
    expect(r).toMatchObject({ ok: true, plan: VALIDO, intentos: 2 });
    expect(llamar.mock.calls[1][0]).toMatch(/TU RESPUESTA ANTERIOR TUVO ESTOS PROBLEMAS[\s\S]*vuela/);
  });

  it("tres intentos sin plan válido: respaldo (la pieza sigue con su estilo), con los últimos problemas", async () => {
    const llamar = vi.fn().mockResolvedValue("no es json");
    const r = await generarPlanIlustrado(ESCENAS, llamar);
    expect(r.ok).toBe(false);
    expect(llamar).toHaveBeenCalledTimes(3);
  });
});

describe("planTrasRegenerarVoz (editar una narración)", () => {
  const tiempos = (n: number[]) => n.map((cuenta, i) => ({ escena_id: `e${i + 1}`, palabras: Array.from({ length: cuenta }, (_, k) => ({ inicio_s: i * 3 + k * 0.35 })) }));

  it("si el plan sigue calzando con el texto nuevo, se mantiene sin llamar a la IA", async () => {
    const llamar = vi.fn();
    const r = await planTrasRegenerarVoz({ escenas: ESCENAS, ilustrado: VALIDO as never, palabrasPorEscena: tiempos([7, 8]) }, { activo: true, llamarIA: llamar });
    expect(r.estado).toBe("se_mantiene");
    expect(llamar).not.toHaveBeenCalled();
  });

  it("si el texto nuevo tiene menos palabras y el plan ya no calza, se vuelve a pedir", async () => {
    const corta = [ESCENAS[0], { id: "e2", narracion: "Y se te va una moneda" }];
    const nuevo = { frases: [VALIDO.frases[0], { escena_id: "e2", acciones: [{ escena: "billetera", accion: "sale_moneda", palabra: 4 }] }] };
    const llamar = vi.fn().mockResolvedValue(JSON.stringify(nuevo));
    const r = await planTrasRegenerarVoz({ escenas: corta, ilustrado: VALIDO as never, palabrasPorEscena: tiempos([7, 5]) }, { activo: true, llamarIA: llamar });
    expect(r.estado).toBe("replanificado");
    const e2 = (r.guion.ilustrado as { frases: { acciones: { accion: string; palabra: number }[] }[] } | undefined)?.frases[1];
    expect(e2?.acciones.find((a) => a.accion === "sale_moneda")?.palabra).toBe(4);
  });

  it("si no calza y la cuenta ya no está en la lista, o la IA no logra un plan válido: vuelve a su estilo (sin 'ilustrado')", async () => {
    const corta = [ESCENAS[0], { id: "e2", narracion: "Y se te va" }];
    const r1 = await planTrasRegenerarVoz({ escenas: corta, ilustrado: VALIDO as never }, { activo: false, llamarIA: vi.fn() });
    expect(r1.estado).toBe("respaldo");
    expect("ilustrado" in r1.guion).toBe(false);
    const r2 = await planTrasRegenerarVoz({ escenas: corta, ilustrado: VALIDO as never }, { activo: true, llamarIA: vi.fn().mockResolvedValue("{}") });
    expect(r2.estado).toBe("respaldo");
  });

  it("pieza sin plan y cuenta fuera de la lista: no cambia nada", async () => {
    const llamar = vi.fn();
    const r = await planTrasRegenerarVoz({ escenas: ESCENAS }, { activo: false, llamarIA: llamar });
    expect(r.estado).toBe("sin_plan");
    expect(llamar).not.toHaveBeenCalled();
  });
});
