// QC por visión del reel ilustrado: que apruebe un reel bueno y rechace
// los casos malos reales (no permisivo). El modelo de visión se simula
// con sus respuestas; lo que se prueba es qué cuadros se revisan, qué se
// le pide y cómo se clasifica.
import { describe, expect, it } from "vitest";
import { erroresQCIlustrado, momentosControlIlustrado, promptControlIlustrado, type HallazgoIlustrado } from "./controlCalidadIlustrado";
import { PLAN_PROTOTIPO } from "@/video/ilustrado/planPrototipo";
import tiemposReales from "@/video/ilustrado/fixtures/tiemposPrototipoReales.json";
import type { TiemposIlustrado } from "@/video/ilustrado/tiempoIlustrado";
import { prepararReel } from "@/video/ilustrado/motor/preparar";
import { camaraEnCuadro } from "@/video/ilustrado/tiempoIlustrado";

const BIEN: Omit<HallazgoIlustrado, "cuadro"> = {
  pantalla_vacia: false,
  lo_nombrado_visible: true,
  lo_nombrado_grande: true,
  objeto_cortado: false,
  subtitulo_ilegible: false,
  subtitulo_tapa_lo_nombrado: false,
  foto_con_texto: false,
  nota: "Se ve bien.",
};
const ETIQUETAS = ["inicio", "toma 1", "toma 2", "toma 3"];
const respuesta = (cambios: Record<string, Partial<HallazgoIlustrado>> = {}) => ETIQUETAS.map((cuadro) => ({ cuadro, ...BIEN, ...(cambios[cuadro] ?? {}) }));

describe("momentos que revisa el QC del reel ilustrado", () => {
  const momentos = momentosControlIlustrado(tiemposReales as TiemposIlustrado, PLAN_PROTOTIPO);

  it("el inicio y una toma por tercio, con la duración REAL (no la estimada) y lo que debería verse", () => {
    expect(momentos.map((m) => m.etiqueta)).toEqual(ETIQUETAS);
    expect(momentos[0].segundo).toBeCloseTo(0.1);
    const duracion = prepararReel(tiemposReales as TiemposIlustrado, PLAN_PROTOTIPO, 30).linea.duracionCuadros / 30;
    expect(momentos[3].segundo).toBeGreaterThan((duracion * 2) / 3);
    expect(momentos[3].segundo).toBeLessThan(duracion);
    for (const m of momentos) expect(m.esperado.length).toBeGreaterThan(20);
    expect(momentos[0].esperado).toMatch(/celular grande con un feed/);
  });

  it("cada toma se revisa con la cámara quieta (no a mitad de un viaje)", () => {
    const reel = prepararReel(tiemposReales as TiemposIlustrado, PLAN_PROTOTIPO, 30);
    for (const m of momentos.slice(1)) {
      const f = Math.round(m.segundo * 30);
      const a = camaraEnCuadro(reel.camara, f - 1);
      const b = camaraEnCuadro(reel.camara, f);
      expect(Math.abs(b.x - a.x) + Math.abs(b.y - a.y), m.etiqueta).toBeLessThan(3);
    }
  });
});

describe("prompt del QC del reel ilustrado", () => {
  const prompt = promptControlIlustrado([{ etiqueta: "inicio", esperado: "un celular grande con un chat y burbujas de mensajes" }]);
  it("dice qué debería verse en cada cuadro y qué es un error real", () => {
    expect(prompt).toContain("- inicio: un celular grande con un chat y burbujas de mensajes");
    expect(prompt).toMatch(/chat SIN ningún mensaje.*SÍ cuenta como vacía/);
    expect(prompt).toMatch(/foto_con_texto: .*captura de pantalla/);
    expect(prompt).toMatch(/subtitulo_tapa_lo_nombrado/);
  });
  it("tolera solo el texto decorativo de la app bajo el subtítulo", () => {
    expect(prompt).toMatch(/no cuenta si solo cubre texto decorativo de la app/);
  });
});

describe("clasificación del QC del reel ilustrado", () => {
  it("caso bueno: aprueba", () => {
    expect(erroresQCIlustrado(respuesta(), ETIQUETAS)).toEqual([]);
  });

  it("primer cuadro vacío (chat sin mensajes): rechaza", () => {
    const e = erroresQCIlustrado(respuesta({ inicio: { pantalla_vacia: true, nota: "Chat sin mensajes." } }), ETIQUETAS);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/"inicio": pantalla vacía/);
  });

  it("subtítulo tapando lo nombrado: rechaza", () => {
    const e = erroresQCIlustrado(respuesta({ "toma 2": { subtitulo_tapa_lo_nombrado: true } }), ETIQUETAS);
    expect(e[0]).toMatch(/"toma 2": el subtítulo tapa lo que nombra la voz/);
  });

  it("foto con texto metida como producto en el anuncio: rechaza", () => {
    const e = erroresQCIlustrado(respuesta({ "toma 1": { foto_con_texto: true } }), ETIQUETAS);
    expect(e[0]).toMatch(/foto con texto o captura usada como producto/);
  });

  it("lo nombrado no se ve, se ve chico, o está cortado; subtítulo ilegible: rechaza", () => {
    expect(erroresQCIlustrado(respuesta({ "toma 3": { lo_nombrado_visible: false } }), ETIQUETAS)[0]).toMatch(/no se ve lo que nombra la voz/);
    expect(erroresQCIlustrado(respuesta({ "toma 3": { lo_nombrado_grande: false } }), ETIQUETAS)[0]).toMatch(/se ve chico/);
    expect(erroresQCIlustrado(respuesta({ "toma 3": { objeto_cortado: true } }), ETIQUETAS)[0]).toMatch(/cortado/);
    expect(erroresQCIlustrado(respuesta({ inicio: { subtitulo_ilegible: true } }), ETIQUETAS)[0]).toMatch(/subtítulo ilegible/);
  });

  it("no permisivo: un cuadro que falta, un campo que no es booleano o la visión sin respuesta cuentan como problema", () => {
    expect(erroresQCIlustrado(respuesta().slice(0, 3), ETIQUETAS)[0]).toMatch(/"toma 3" \(respuesta incompleta\)/);
    expect(erroresQCIlustrado(respuesta({ inicio: { pantalla_vacia: "no" as unknown as boolean } }), ETIQUETAS)[0]).toMatch(/respuesta incompleta/);
    expect(erroresQCIlustrado(undefined, ETIQUETAS)).toHaveLength(4);
  });
});
