// Prueba de estrés (pedida tras la 3ra recurrencia real de
// "inputRange must be strictly monotonically increasing", esta vez en
// el fundido de audio de CapaVoz.tsx): tiempos extremos que YA
// tumbaron un render real en staging alguna vez (eventos en el mismo
// cuadro, palabras de duración 0 de Whisper, segmentos de 1 cuadro,
// escenas muy cortas) contra cada visual/capa de audio que usa tiempos
// calculados. El objetivo es que NINGUNO lance, no cubrir cada línea.
//
// Los componentes de presentación puros (reciben frame/fps/eventos ya
// calculados, sin hooks de Remotion) se ejercitan con
// renderToStaticMarkup() -- mismo patrón ya usado en
// Cta.navegador.test.ts para BotonGrande/CursorClic, pero sin
// Playwright: acá solo importa que no lance, no medir layout real.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { valorContadorEnFrame } from "./visuales/Contador";
import { calcularLlegadaCursor, CursorClicEventos } from "./visuales/CursorClicEventos";
import { calcularVolumenConFade } from "./visuales/CapaVoz";
import { calcularVolumenDeMusica } from "./capas/Musica";
import { calcularCurvaDucking } from "./visuales/CapaMusicaConDucking";
import { AnuncioBotonVisual } from "./visuales/AnuncioBotonVisual";
import { ConexionWhatsappVisual } from "./visuales/ConexionWhatsappVisual";
import { RespuestaLentaVisual } from "./visuales/RespuestaLentaVisual";
import { CursorClic } from "./escenas/Cta";
import type { TemaGuion } from "./tema";

const TEMA: TemaGuion = { color_primario: "#534AB7", color_secundario: "#7F77DD", fuente: "moderna", logo_url: null, nombre_marca: "Quiubot" };

// Cuadros/fps extremos reales: eventos en el mismo cuadro exacto,
// cuadroCambia=0 (evento en la primerísima palabra), fps=30 estándar
// con tramos de 1 solo cuadro (palabra de duración 0 de Whisper).
const CASOS_FRAME_FPS: { frame: number; fps: number; cuadroCambia: number }[] = [
  { frame: 0, fps: 30, cuadroCambia: 0 }, // evento en el cuadro 0 mismo
  { frame: 5, fps: 30, cuadroCambia: 5 }, // frame EXACTO del evento
  { frame: 1000, fps: 30, cuadroCambia: 1 }, // frame muy por delante del evento
  { frame: 0, fps: 30, cuadroCambia: 1000 }, // evento muy por delante del frame
];

describe("prueba de estrés -- tiempos extremos, nada debe lanzar", () => {
  it("valorContadorEnFrame: eventos en el mismo cuadro, frames negativos, rango invertido por error de llamador", () => {
    for (const { frame, cuadroCambia } of CASOS_FRAME_FPS) {
      expect(() => valorContadorEnFrame(frame, cuadroCambia, cuadroCambia, 0, 3)).not.toThrow();
      expect(() => valorContadorEnFrame(frame, cuadroCambia, cuadroCambia + 1, 0, 3)).not.toThrow();
    }
    expect(() => valorContadorEnFrame(-50, 0, 0, 0, 3)).not.toThrow();
  });

  it("calcularLlegadaCursor: aparece===clic, y 'clic' llegando antes que 'aparece' (palabras fuera de orden)", () => {
    for (const { frame, cuadroCambia } of CASOS_FRAME_FPS) {
      expect(() => calcularLlegadaCursor(frame, cuadroCambia, cuadroCambia)).not.toThrow();
    }
    // Caso que un llamador futuro podría producir si no normaliza con
    // Math.min/Math.max: el evento "clic" resuelto a un cuadro ANTERIOR
    // al de "aparece" (palabras de eventos en orden inverso).
    expect(() => calcularLlegadaCursor(10, 20, 5)).not.toThrow();
  });

  it("calcularVolumenConFade (CapaVoz): segmentos de 1 cuadro, 0 cuadros, y el caso real que tumbó el render (fundido de 15ms a 30fps)", () => {
    for (const duracionCuadros of [0, 1, 2, 3, 46]) {
      for (const frame of [0, 1, 2, 46, 1000]) {
        expect(() => calcularVolumenConFade(frame, duracionCuadros, 30)).not.toThrow();
      }
    }
    // Caso real reportado en staging: duracionCuadros=46, fundido de
    // 15ms a 30fps redondea a 0 -- antes producía [0,0,46,46].
    expect(calcularVolumenConFade(0, 46, 30)).toBe(1);
  });

  it("calcularVolumenDeMusica: video de 0, 1 y 2 cuadros de duración total", () => {
    for (const durationInFrames of [0, 1, 2, 10]) {
      for (const frame of [0, 1, 10, 1000]) {
        expect(() => calcularVolumenDeMusica(frame, durationInFrames, 30, 0.8)).not.toThrow();
      }
    }
  });

  it("calcularCurvaDucking: la voz dura 0 segundos (inicioVoz_s === finVoz_s)", () => {
    expect(() =>
      calcularCurvaDucking({ fps: 30, durationInFrames: 90, volumenNormal: 0.8, volumenConVoz: 0.2, inicioVoz_s: 1, finVoz_s: 1 })
    ).not.toThrow();
    // Reel de 1 solo cuadro de punta a punta.
    expect(() =>
      calcularCurvaDucking({ fps: 30, durationInFrames: 1, volumenNormal: 0.8, volumenConVoz: 0.2, inicioVoz_s: 0, finVoz_s: 0 })
    ).not.toThrow();
  });

  it("CursorClic (Cta.tsx, CTA de la receta normal de anuncios): escena de 1-2 cuadros de duración -- cuadroClic puede caer antes de fps*0.3", () => {
    for (const duracionCuadros of [0, 1, 2, 5]) {
      for (const frame of [0, 1, 5, 100]) {
        expect(() => renderToStaticMarkup(CursorClic({ frame, fps: 30, duracionCuadros }))).not.toThrow();
      }
    }
  });

  it("CursorClicEventos (Fase B v2.0): aparece===clic, renderizado real sin lanzar", () => {
    for (const { frame, cuadroCambia } of CASOS_FRAME_FPS) {
      expect(() => renderToStaticMarkup(CursorClicEventos({ frame, fps: 30, cuadroAparece: cuadroCambia, cuadroClic: cuadroCambia }))).not.toThrow();
    }
  });

  it("AnuncioBotonVisual / ConexionWhatsappVisual / RespuestaLentaVisual: cuadroCambia=0 y frame muy por delante o muy por detrás", () => {
    for (const { frame, cuadroCambia } of CASOS_FRAME_FPS) {
      expect(() => renderToStaticMarkup(AnuncioBotonVisual({ frame, fps: 30, tema: TEMA, cuadroCambia }))).not.toThrow();
      expect(() => renderToStaticMarkup(ConexionWhatsappVisual({ frame, fps: 30, tema: TEMA, cuadroCambia }))).not.toThrow();
      expect(() => renderToStaticMarkup(RespuestaLentaVisual({ frame, fps: 30, cuadroCambia }))).not.toThrow();
    }
  });
});
