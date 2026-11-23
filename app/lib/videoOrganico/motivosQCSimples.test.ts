import { describe, expect, it } from "vitest";
import { MOTIVO_GENERICO, motivosEnLenguajeSimple } from "./motivosQCSimples";
import { erroresDesdeQC } from "./controlCalidadCliente";
import { erroresQCIlustrado } from "./controlCalidadIlustrado";

describe("motivos del control de calidad en lenguaje simple (para el cliente)", () => {
  it("voz cortada, palabra faltante, pausas y silencio: sin jerga ni repetidos", () => {
    const m = motivosEnLenguajeSimple([
      'La voz del video no pasó el control dos veces: Se cortó el comienzo de "Escribe" (segundo 7.80 del video): 185 ms de su arranque no quedaron en el video.',
      'El comienzo de "Sigue" (segundo 19.54 del video) quedó corrido 45 ms en el video.',
      'Falta la primera palabra de una frase en el audio del video: "Escribe" (escena e3).',
      "El audio final mezclado tiene 0.78s de silencio real entre el segundo 12.00 y 12.78 -- revisa compactarPausas()/las pausas de la narración ahí.",
      "El audio final mezclado salió en silencio -- revisa que ninguna narracion haya quedado vacía o con un texto raro para la voz.",
    ]);
    expect(m).toEqual([
      "Una parte de la voz salió cortada o desfasada.",
      'Falta la palabra "Escribe" en la voz del video.',
      "Quedaron pausas demasiado largas en la voz.",
      "El video salió sin sonido.",
    ]);
    expect(m.join(" ")).not.toMatch(/compactarPausas|cuadro|escena e3|ms/);
  });

  it("visión del reel con estilo y del ilustrado: cada problema en palabras simples", () => {
    const estilo = erroresDesdeQC([{ cuadro: "inicio", pantalla_vacia: true, texto_superpuesto: true, contraste_bajo: false, nota: "mitad vacía" }], "con_audio", []);
    const ilustrado = erroresQCIlustrado(
      [{ cuadro: "tercio 1", pantalla_vacia: false, lo_nombrado_visible: false, lo_nombrado_grande: false, objeto_cortado: false, subtitulo_ilegible: true, subtitulo_tapa_lo_nombrado: false, foto_con_texto: true, nota: "x" }],
      ["tercio 1"]
    );
    expect(motivosEnLenguajeSimple([...estilo, ...ilustrado])).toEqual([
      "Una parte del video se ve vacía.",
      "Hay textos encimados que no se leen bien.",
      "Algún texto no se lee bien sobre su fondo.",
      "Lo que dice la voz no se ve con claridad en la imagen.",
      "La foto elegida tiene texto encima o es una captura de pantalla.",
    ]);
  });

  it("créditos de OpenAI: el aviso pasa tal cual; algo desconocido o vacío: motivo genérico", () => {
    expect(motivosEnLenguajeSimple(["Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar."])).toEqual([
      "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar.",
    ]);
    expect(motivosEnLenguajeSimple(["algo raro"])).toEqual([MOTIVO_GENERICO]);
    expect(motivosEnLenguajeSimple(null)).toEqual([MOTIVO_GENERICO]);
  });
});
