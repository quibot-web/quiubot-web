// Pantallas del celular (staging 23 nov 2026, pieza 67d87ce8): el
// celular cambiaba de pantalla al empezar la frase y mostraba el perfil
// y el chat segundos antes de sus acciones, tapando las del feed; y el
// QC esperaba una escena que no estaba en cuadro.
import { describe, expect, it } from "vitest";
import pieza from "../fixtures/guionLikesVsMensajes.json";
import tiemposPrototipo from "../fixtures/tiemposPrototipoReales.json";
import { PLAN_PROTOTIPO } from "../planPrototipo";
import type { TiemposIlustrado } from "../tiempoIlustrado";
import { CATALOGO, ESCENA_VISIBLE, MICRO } from "./catalogo";
import { escenaEnCamara, pantallaEnCuadro, prepararReel } from "./preparar";
import type { PlanIlustrado } from "./plan";
import { MAX_PALABRAS_SIN_ACCION, MIN_PALABRAS_POR_PANTALLA, repararRitmoPorPalabras, tramoMasLargoSinCambio, validarPlanIlustrado } from "./validarPlan";
import { ajustarConVozReal } from "../../../app/lib/videoOrganico/generarPlanIlustrado";
import { momentosControlIlustrado } from "../../../app/lib/videoOrganico/controlCalidadIlustrado";

const TIEMPOS_PIEZA = pieza.tiempos as TiemposIlustrado;
const PLAN_IA = pieza.planIA as PlanIlustrado;

// Plan bueno para esta misma narración: el feed mientras se habla de
// likes y anuncios, la gráfica en "resultado", el chat en "escríbenos",
// el perfil solo al cierre.
const PLAN_BUENO: PlanIlustrado = {
  frases: [
    { escena_id: "e1", acciones: [{ escena: "feed", accion: "se_detiene", palabra: 0 }, { escena: "feed", accion: "aparece_anuncio", palabra: 7 }] },
    { escena_id: "e2", acciones: [{ escena: "feed", accion: "lo_miran", palabra: 6 }, { escena: "feed", accion: "pasa_de_largo", palabra: 8 }] },
    { escena_id: "e3", acciones: [{ escena: "grafica", accion: "sube", palabra: 3 }, { escena: "feed", accion: "aparece_anuncio", palabra: 7 }] },
    { escena_id: "e4", acciones: [{ escena: "chat", accion: "llega_mensaje", palabra: 6 }, { escena: "chat", accion: "llega_mensaje", palabra: 8 }] },
    { escena_id: "e5", acciones: [{ escena: "chat", accion: "responde", palabra: 4 }, { escena: "chat", accion: "llega_mensaje", palabra: 9 }] },
    { escena_id: "e6", acciones: [{ escena: "perfil", accion: "aparece", palabra: 0 }, { escena: "perfil", accion: "toque_seguir", palabra: 2 }] },
  ],
};

function sinPantallaEquivocada(nombre: string, tiempos: TiemposIlustrado, plan: PlanIlustrado) {
  it(`${nombre}: en ningún cuadro se ve una pantalla del celular distinta a la de la acción que está ocurriendo, y no hay parpadeos`, () => {
    const reel = prepararReel(tiempos, plan, 30);
    const delCelular = reel.disparos.filter((d) => CATALOGO[d.escena].isla === "celular" && d.accion !== MICRO);
    delCelular.forEach((d, i) => {
      // Cada acción se ve en SU pantalla desde su cuadro y al menos 0,4 s
      // (o hasta la acción siguiente del celular, si llega antes). Con un
      // plan válido (>= 4 palabras por pantalla) eso es más de 1 s.
      const hasta = Math.min(delCelular[i + 1]?.cuadro ?? Infinity, d.cuadro + 12);
      for (let f = d.cuadro; f < hasta; f++) expect(pantallaEnCuadro(reel, f), `${d.frase} ${d.escena}.${d.accion}, cuadro ${f}`).toBe(d.escena);
    });
    for (let i = 1; i < reel.pantallas.length; i++) expect(reel.pantallas[i].cuadro - reel.pantallas[i - 1].cuadro, "parpadeo").toBeGreaterThanOrEqual(10);
  });
}

describe("pantallas del celular amarradas a sus acciones", () => {
  sinPantallaEquivocada("plan de la IA de la pieza 67d87ce8 (caótico)", TIEMPOS_PIEZA, PLAN_IA);
  sinPantallaEquivocada("plan bueno de la misma pieza", TIEMPOS_PIEZA, ajustarConVozReal(repararRitmoPorPalabras(PLAN_BUENO, pieza.escenas).plan, TIEMPOS_PIEZA.palabrasPorEscena).plan);
  sinPantallaEquivocada("prototipo aprobado", tiemposPrototipo as TiemposIlustrado, PLAN_PROTOTIPO);

  it("el QC espera lo que el reel MUESTRA en cada cuadro (antes esperaba un perfil donde se veía el feed)", () => {
    const reel = prepararReel(TIEMPOS_PIEZA, PLAN_IA, 30);
    for (const m of momentosControlIlustrado(TIEMPOS_PIEZA, PLAN_IA)) {
      const escena = escenaEnCamara(reel, Math.round(m.segundo * 30))!;
      expect(m.esperado, m.etiqueta).toContain(ESCENA_VISIBLE[escena]);
    }
  });
});

describe("reglas del plan con el guion de la pieza 67d87ce8", () => {
  it("el plan que escribió la IA ahora se rechaza: perfil a mitad del reel, dos acciones en la misma palabra y acciones después de Seguir", () => {
    const p = validarPlanIlustrado(PLAN_IA, pieza.escenas).join(" | ");
    expect(p).toMatch(/e3: el perfil \(Seguir\) solo va en la última frase/);
    expect(p).toMatch(/e6: "perfil.aparece" y "perfil.toque_seguir" están en la misma palabra/);
    expect(p).toMatch(/después de tocar Seguir no va nada más/);
  });

  it("permanencia de pantalla (>= 4 palabras) y ritmo (<= 7 palabras, <= 2,5 s con la voz real) se cumplen JUNTOS con micro-acciones de la misma pantalla", () => {
    const reparado = repararRitmoPorPalabras(PLAN_BUENO, pieza.escenas);
    expect(validarPlanIlustrado(reparado.plan, pieza.escenas)).toEqual([]);
    // Las micro-acciones insertadas son de la pantalla que ya estaba: no cambian de pantalla.
    for (const f of reparado.plan.frases) for (const a of f.acciones.filter((x) => x.accion === MICRO)) expect(["feed", "chat", "grafica", "perfil"]).toContain(a.escena);
    const final = ajustarConVozReal(reparado.plan, TIEMPOS_PIEZA.palabrasPorEscena).plan;
    expect(validarPlanIlustrado(final, pieza.escenas)).toEqual([]);
    expect(tramoMasLargoSinCambio(final, TIEMPOS_PIEZA.palabrasPorEscena)).toBeLessThanOrEqual(2.5);
    expect(MIN_PALABRAS_POR_PANTALLA).toBeLessThan(MAX_PALABRAS_SIN_ACCION);
  });

  it("una pantalla que dura menos de 4 palabras se rechaza con la palabra concreta a la que moverla", () => {
    const corto: PlanIlustrado = { frases: PLAN_BUENO.frases.map((f) => (f.escena_id === "e4" ? { ...f, acciones: [{ escena: "chat", accion: "llega_mensaje", palabra: 6 }, { escena: "feed", accion: "desliza", palabra: 8 }] } : f)) };
    expect(validarPlanIlustrado(corto, pieza.escenas).join(" ")).toMatch(/la pantalla "chat" del celular dura solo 2 palabra\(s\).*mueve "feed.desliza" a e4\[10\]/);
  });
});
