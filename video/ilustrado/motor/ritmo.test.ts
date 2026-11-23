// Ritmo del plan ilustrado con un guion REAL de frases largas (pieza
// 5d9ff2d4, staging 23 nov 2026): la IA dejó 8 palabras sin cambio y el
// plan se rechazaba entero. Ahora se rellena con micro-acciones neutras
// de la escena en pantalla, antes de la voz por palabras y después de la
// voz por tiempo (regla final: ningún tramo de más de 2,5 s sin cambio).
import { describe, expect, it, vi } from "vitest";
import guion from "../fixtures/guionFrasesLargas.json";
import { generarPlanIlustrado, ajustarConVozReal } from "../../../app/lib/videoOrganico/generarPlanIlustrado";
import { MAX_SEGUNDOS_SIN_CAMBIO, rellenarRitmoPorTiempo, repararRitmoPorPalabras, tramoMasLargoSinCambio, validarPlanIlustrado } from "./validarPlan";
import type { PlanIlustrado } from "./plan";

const ESCENAS = guion.escenas;
// Plan como el que escribió la IA: tres huecos (9 palabras dentro de e1,
// 8 antes de chat.llega_mensaje en e2 y 8 antes de perfil.aparece en e6).
const PLAN_DE_LA_IA: PlanIlustrado = {
  frases: [
    { escena_id: "e1", acciones: [{ escena: "reloj_cliente", accion: "espera", palabra: 0 }, { escena: "reloj_cliente", accion: "reloj_acelera", palabra: 9 }] },
    { escena_id: "e2", acciones: [{ escena: "chat", accion: "llega_mensaje", palabra: 7 }] },
    { escena_id: "e3", acciones: [{ escena: "chat", accion: "responde", palabra: 1 }, { escena: "chat", accion: "llega_mensaje", palabra: 5 }] },
    { escena_id: "e4", acciones: [{ escena: "multitud", accion: "se_iluminan", palabra: 2 }, { escena: "multitud", accion: "miran_arriba", palabra: 6 }] },
    { escena_id: "e5", acciones: [{ escena: "grafica", accion: "sube", palabra: 2 }] },
    { escena_id: "e6", acciones: [{ escena: "perfil", accion: "aparece", palabra: 0 }, { escena: "perfil", accion: "toque_seguir", palabra: 2 }] },
  ],
};

describe("ritmo con frases largas (guion real 5d9ff2d4)", () => {
  it("antes: el plan se rechazaba; el mensaje de reintento ahora dice en qué palabras puede ir una acción", () => {
    const problemas = validarPlanIlustrado(PLAN_DE_LA_IA, ESCENAS);
    expect(problemas.join(" ")).toMatch(/e2: hay 8 palabras sin ningún cambio antes de "chat.llega_mensaje"/);
    expect(problemas.join(" ")).toMatch(/pon una acción en alguna de estas palabras: .*e2\[0\] "Activa"/);
  });

  it("ahora: se inserta una micro-acción NEUTRA de la escena en pantalla en la mitad del hueco (nunca se adelanta la imagen)", () => {
    const { plan, ajustes } = repararRitmoPorPalabras(PLAN_DE_LA_IA, ESCENAS);
    expect(validarPlanIlustrado(plan, ESCENAS)).toEqual([]);
    expect(ajustes).toHaveLength(3);
    const e2 = plan.frases.find((f) => f.escena_id === "e2")!;
    expect(e2.acciones).toContainEqual({ escena: "reloj_cliente", accion: "micro", palabra: 3 }); // el reloj seguía en pantalla
    const e5 = plan.frases.find((f) => f.escena_id === "e5")!;
    expect(e5.acciones.some((a) => a.escena === "grafica" && a.accion === "micro")).toBe(true);
    // Las acciones que nombra la voz no se movieron.
    expect(e2.acciones.find((a) => a.accion === "llega_mensaje")!.palabra).toBe(7);
  });

  it("el generador acepta ese plan al primer intento (antes caía al estilo viejo tras 3 intentos)", async () => {
    const llamar = vi.fn().mockResolvedValue(JSON.stringify(PLAN_DE_LA_IA));
    const r = await generarPlanIlustrado(ESCENAS, llamar);
    expect(r.ok).toBe(true);
    expect(llamar).toHaveBeenCalledTimes(1);
    if (r.ok) expect(r.ajustes.length).toBeGreaterThan(0);
  });

  it("con la voz real: ningún tramo de más de 2,5 s sin cambio (regla final por tiempo)", () => {
    const { plan } = repararRitmoPorPalabras(PLAN_DE_LA_IA, ESCENAS);
    const final = ajustarConVozReal(plan, guion.palabrasPorEscena).plan;
    expect(tramoMasLargoSinCambio(final, guion.palabrasPorEscena)).toBeLessThanOrEqual(MAX_SEGUNDOS_SIN_CAMBIO);
    expect(validarPlanIlustrado(final, ESCENAS)).toEqual([]);
  });

  it("relleno por tiempo: un tramo largo que las palabras no detectan (pausa larga) se rellena con la escena en pantalla", () => {
    const p: PlanIlustrado = { frases: [{ escena_id: "e1", acciones: [{ escena: "billetera", accion: "sale_moneda", palabra: 0 }, { escena: "billetera", accion: "se_llena", palabra: 5 }] }] };
    const tiempos = [{ escena_id: "e1", palabras: [0, 0.3, 0.6, 2.0, 2.4, 3.6].map((inicio_s) => ({ inicio_s })) }];
    expect(tramoMasLargoSinCambio(p, tiempos)).toBeGreaterThan(2.5);
    const { plan, ajustes } = rellenarRitmoPorTiempo(p, tiempos);
    expect(plan.frases[0].acciones).toContainEqual({ escena: "billetera", accion: "micro", palabra: 3 });
    expect(ajustes[0]).toMatch(/tramo de 3\.6 s/);
    expect(tramoMasLargoSinCambio(plan, tiempos)).toBeLessThanOrEqual(2.5);
  });
});

describe("historial de intentos", () => {
  it("si los 3 intentos fallan, quedan los problemas de los 3 (no solo del último)", async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce("no es json")
      .mockResolvedValueOnce(JSON.stringify({ frases: [{ escena_id: "e1", acciones: [{ escena: "feed", accion: "vuela", palabra: 0 }] }] }))
      .mockResolvedValueOnce(JSON.stringify({ frases: [] }));
    const r = await generarPlanIlustrado(ESCENAS, llamar);
    expect(r.ok).toBe(false);
    expect(r.historial).toHaveLength(3);
    expect(r.historial[0][0]).toMatch(/JSON/);
    expect(r.historial[1].join(" ")).toMatch(/vuela/);
  });
});
