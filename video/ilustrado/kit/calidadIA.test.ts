// La composición de la IA tiene que quedar a la altura de la hecha a mano
// (revisión de la v6). Los planes son salidas reales de la IA (gpt-5.6-sol)
// con el kit, guardados como fixtures: si una regla nueva los empeora, la
// prueba lo muestra.
import { describe, expect, it } from "vitest";
import { NARRACION_PROTOTIPO_KIT, PLAN_PROTOTIPO_KIT } from "./planPrototipoKit";
import planIA from "../fixtures/planIAKit.json";
import planAlumnos from "../fixtures/planIAAlumnos.json";
import tiemposKit from "../fixtures/tiemposPrototipoKit.json";
import tiemposAlumnos from "../fixtures/tiemposAlumnos.json";
import { prepararReel, camaraDelCuadro } from "../motor/preparar";
import { metricasKit } from "../motor/metricasKit";
import { cuerposEnMundo } from "../motor/camara";
import { carasCortadas } from "../motor/encuadreKit";
import { validarPlanIlustrado } from "../motor/validarPlan";
import { disparosDeEscena } from "../motor/plan";
import { tapanCaras } from "./EscenaKit";
import type { PlanIlustrado } from "../motor/plan";
import type { TiemposIlustrado } from "../tiempoIlustrado";

const mano = metricasKit(prepararReel(tiemposKit as TiemposIlustrado, PLAN_PROTOTIPO_KIT, 30, "prototipo-kit"), 30);
const reelIA = prepararReel(tiemposKit as TiemposIlustrado, planIA as PlanIlustrado, 30, "prototipo-kit-ia");
const ia = metricasKit(reelIA, 30);
const reelAlumnos = prepararReel(tiemposAlumnos as TiemposIlustrado, planAlumnos as PlanIlustrado, 30, "alumnos-ia");

describe("calidad de la composición de la IA comparada con la hecha a mano (mismo texto)", () => {
  it("los planes de la IA pasan todas las reglas (también las de director)", () => {
    expect(validarPlanIlustrado(planIA, NARRACION_PROTOTIPO_KIT)).toEqual([]);
    expect(validarPlanIlustrado(planAlumnos, tiemposAlumnos.escenas)).toEqual([]);
  });

  it("personajes visibles, cambios de plano por segundo y pantalla útil ocupada en un rango parecido", () => {
    expect(ia.personajesVisibles).toBeGreaterThanOrEqual(mano.personajesVisibles * 0.75);
    expect(ia.cortesPorSegundo).toBeGreaterThanOrEqual(mano.cortesPorSegundo * 0.75);
    expect(ia.cortesPorSegundo).toBeLessThanOrEqual(mano.cortesPorSegundo * 1.5);
    expect(ia.ocupacionUtil).toBeGreaterThanOrEqual(mano.ocupacionUtil * 0.75);
  });

  it("las dos composiciones de la IA: ningún plano de más de ~2 s, sin piso vacío y ninguna cara cortada en ningún cuadro", () => {
    for (const [nombre, reel] of [["cartelera", reelIA], ["alumnos", reelAlumnos]] as const) {
      const m = metricasKit(reel, 30);
      expect(m.planoMasLargo, nombre).toBeLessThanOrEqual(2.2);
      expect(m.pisoVacioMaximo, nombre).toBeLessThanOrEqual(0.25);
      const cu = reel.registro.composicion("k_salon")!;
      const d = disparosDeEscena(reel.disparos, "k_salon");
      const objetivos = reel.disparos.filter((x) => x.escena === "k_salon" && x.objetivo).map((x) => ({ accion: x.accion, cuadro: x.cuadro, objetivo: x.objetivo! }));
      const tapadas = Array.from({ length: reel.linea.duracionCuadros }, (_, f) => tapanCaras(cu, d, objetivos, f, 30)).filter((x) => x.length);
      expect(tapadas, nombre).toEqual([]);
      const cuerpos = cuerposEnMundo("k_salon", reel.recorrido, reel.registro);
      const cortadas = Array.from({ length: reel.linea.duracionCuadros }, (_, f) => carasCortadas(camaraDelCuadro(reel, f), cuerpos)).filter((c) => c.length);
      expect(cortadas, nombre).toEqual([]);
    }
  });

  it("escena poblada: el salón de la IA tiene al menos 5 personajes (con los extras del código)", () => {
    for (const reel of [reelIA, reelAlumnos]) expect(reel.registro.composicion("k_salon")!.personajes.length).toBeGreaterThanOrEqual(5);
  });
});
