// "Parte 1 de 2" visible al inicio de un reel de serie (reel ilustrado:
// dentro de la píldora del subtítulo).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Subtitulo } from "./Subtitulo";
import { construirLineaDeTiempo } from "../tiempoIlustrado";
import { tiemposSinteticos } from "../guionPrototipo";
import { CUADROS_CHIP_SERIE, textoSerie } from "../../capas/ChipSerie";
import { propsReelIlustradoDesdeGuion } from "../desdeGuion";
import { PLAN_PROTOTIPO } from "../planPrototipo";
import type { Guion } from "../../guion.schema";

describe("Parte k de N al inicio del reel", () => {
  const linea = construirLineaDeTiempo(tiemposSinteticos(), 30);
  it("se ve en el subtítulo los primeros 2,5 s y después desaparece", () => {
    const html = (frame: number) => renderToStaticMarkup(createElement(Subtitulo, { linea, frame, luz: "#B9B2FF", etiqueta: textoSerie({ parte: 1, total: 2 }) }));
    expect(html(0)).toContain("Parte 1 de 2");
    expect(html(CUADROS_CHIP_SERIE - 1)).toContain("Parte 1 de 2");
    expect(html(CUADROS_CHIP_SERIE)).not.toContain("Parte 1 de 2");
  });
  it("el guion de una parte le pasa la serie al reel ilustrado", () => {
    const guion = {
      tiemposRender: [{ escena_id: "e1", inicio_s: 0, fin_s: 1 }],
      palabrasPorEscena: [{ escena_id: "e1", palabras: [] }],
      segmentosAudio: [{ escena_id: "e1", tramos: [] }],
      vozUrl: "v.mp3",
      tema: { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna", logo_url: null, nombre_marca: "Q", instagramUsuario: null },
      musica: { pista_id: null, volumen: 0.35 },
      ilustrado: PLAN_PROTOTIPO,
      serie: { parte: 2, total: 3 },
    } as unknown as Guion;
    expect(propsReelIlustradoDesdeGuion(guion, undefined, null)?.serie).toEqual({ parte: 2, total: 3 });
  });
});
