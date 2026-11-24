// Variedad entre reels de una cuenta (etapa A de visuales-v2): no repetir
// lo de los últimos 3 reels (pared, paleta de ropa, movimiento de cámara,
// escena de apertura), guardado dentro del guion (plan.variedad), sin SQL.
import { describe, expect, it } from "vitest";
import { elegirVariedad, huellaDePlan, huellasDePiezas, MOVIMIENTOS_CAMARA, PALETAS_ROPA, problemasVariedad, textoVariedadParaPrompt, type HuellaVisual } from "./variedad";
import { NARRACION_PROTOTIPO_KIT, PLAN_PROTOTIPO_KIT } from "./planPrototipoKit";
import { PAREDES } from "./catalogoKit";
import tiemposKit from "../fixtures/tiemposPrototipoKit.json";
import { camaraDelCuadro, prepararReel } from "../motor/preparar";
import { cuerposEnMundo } from "../motor/camara";
import { carasCortadas } from "../motor/encuadreKit";
import { validarPlanIlustrado } from "../motor/validarPlan";
import { construirPromptPlanIlustrado } from "../promptPlanIlustrado";
import type { TiemposIlustrado } from "../tiempoIlustrado";

describe("variedad entre reels", () => {
  it("pared, paleta de ropa y movimiento de cámara nunca repiten los de los últimos 3 reels", () => {
    const historial: HuellaVisual[] = [];
    for (let i = 0; i < 12; i++) {
      const v = elegirVariedad(historial, `reel-${i}`);
      for (const h of historial.slice(0, 3)) {
        expect(v.pared, `reel ${i}`).not.toBe(h.pared);
        expect(v.paleta, `reel ${i}`).not.toBe(h.paleta);
        expect(v.camara, `reel ${i}`).not.toBe(h.camara);
      }
      historial.unshift(v); // la más reciente primero
    }
    // Hay suficientes opciones para que siempre quede una libre.
    expect(Object.keys(PAREDES).length).toBeGreaterThan(3);
    expect(Object.keys(PALETAS_ROPA).length).toBeGreaterThan(3);
    expect(MOVIMIENTOS_CAMARA.length).toBeGreaterThan(3);
  });

  it("la huella de un plan: apertura y lugares (el kit cuenta por su fondo) más su variedad", () => {
    const h = huellaDePlan({ ...PLAN_PROTOTIPO_KIT, variedad: { pared: "menta", paleta: "fria", camara: "alejar" } });
    expect(h.apertura).toBe("feed");
    expect(h.lugares).toEqual(expect.arrayContaining(["feed", "kit:salon", "perfil"]));
    expect(h.pared).toBe("menta");
  });

  it("abrir con la misma escena que uno de los últimos 3 reels es un problema para la IA (y el prompt se lo avisa)", () => {
    const historial: HuellaVisual[] = [{ apertura: "feed", lugares: ["feed", "kit:salon"] }];
    expect(problemasVariedad(PLAN_PROTOTIPO_KIT, historial).join(" ")).toMatch(/abre con "feed"/);
    expect(validarPlanIlustrado(PLAN_PROTOTIPO_KIT, NARRACION_PROTOTIPO_KIT, { historial }).join(" ")).toMatch(/abre con "feed"/);
    expect(validarPlanIlustrado(PLAN_PROTOTIPO_KIT, NARRACION_PROTOTIPO_KIT, { historial: [{ apertura: "chat" }] })).toEqual([]);
    const prompt = construirPromptPlanIlustrado(NARRACION_PROTOTIPO_KIT, undefined, { conKit: true, historial });
    expect(prompt).toMatch(/VARIEDAD/);
    expect(prompt).toMatch(/NO puede abrir con ninguna de esas/);
    expect(textoVariedadParaPrompt([])).toBe("");
  });

  it("la pared y la paleta del reel se aplican al lugar (lo que la IA no fija)", () => {
    const plan = { ...PLAN_PROTOTIPO_KIT, variedad: { pared: "durazno", paleta: "fria", camara: "quieta" } as const };
    const comp = { ...plan.composiciones![0], pared: undefined, personajes: plan.composiciones![0].personajes.map((p) => ({ ...p, ropa: undefined })) };
    const reel = prepararReel(tiemposKit as TiemposIlustrado, { ...plan, composiciones: [comp] }, 30, "x");
    const cu = reel.registro.composicion("k_salon")!;
    expect(cu.pared).toBe("durazno");
    for (const u of cu.personajes) expect(PALETAS_ROPA.fria as readonly string[]).toContain(u.aspecto.ropa);
  });

  it("con cualquier movimiento de cámara, nadie queda con la cara cortada", () => {
    for (const camara of MOVIMIENTOS_CAMARA) {
      const reel = prepararReel(tiemposKit as TiemposIlustrado, { ...PLAN_PROTOTIPO_KIT, variedad: { pared: "crema", paleta: "calida", camara } }, 30, "x");
      const cuerpos = cuerposEnMundo("k_salon", reel.recorrido, reel.registro);
      const malos = Array.from({ length: reel.linea.duracionCuadros }, (_, f) => carasCortadas(camaraDelCuadro(reel, f), cuerpos)).filter((c) => c.length);
      expect(malos, camara).toEqual([]);
    }
  });

  it("las huellas se leen del guion guardado de las piezas anteriores; un plan roto o sin plan no cuenta", () => {
    const huellas = huellasDePiezas([{ ilustrado: { ...PLAN_PROTOTIPO_KIT, variedad: { pared: "menta", paleta: "fria", camara: "alejar" } } }, { ilustrado: null }, { ilustrado: { frases: "x" } }, {}]);
    expect(huellas).toHaveLength(1);
    expect(huellas[0].camara).toBe("alejar");
  });
});
