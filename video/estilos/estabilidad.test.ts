// Ningún elemento ya visible cambia de posición cuando entra otro
// (revisión del paso 3: en la comparación "Así no / Así sí" la primera
// banda aparecía a una altura y saltaba al entrar la segunda, en Color
// pleno y en Foto). Sin navegador no hay motor de layout, así que se
// verifica en el HTML renderizado:
// - los elementos marcados con data-estable tienen EXACTAMENTE los mismos
//   estilos de posición (top/bottom/left/right/transform...) antes y
//   después del cambio -- solo pueden cambiar color y opacidad;
// - lo que va en flujo normal (filas del checklist, notificaciones del
//   celular) no gana ni pierde hermanos al aparecer algo: el espacio
//   está reservado desde el cuadro 0.
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// fitText/measureText necesitan el canvas del navegador; el tamaño de
// letra no cambia la posición de lo que se prueba acá.
vi.mock("@remotion/layout-utils", () => ({
  fitText: () => ({ fontSize: 50 }),
  measureText: ({ text, fontSize }: { text: string; fontSize: number }) => ({ width: text.length * fontSize * 0.6, height: fontSize }),
}));

import { paletaDeEstilo, type EstiloVisualId } from "./estilos";
import { ChecklistEstilo, ComparacionEstilo, PantallaDividida } from "./VisualesEstilo";
import { ComparacionVisual } from "../visuales/ComparacionVisual";
import { CelularChat } from "../visuales/CelularChat";
import { RespuestaLentaVisual } from "../visuales/RespuestaLentaVisual";
import type { TemaGuion } from "../tema";

const TEMA: TemaGuion = { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna", logo_url: null, nombre_marca: "Marca", instagramUsuario: null };
const FPS = 30;
const CAMBIO = 60;
const ANTES = 20;
const DESPUES = CAMBIO + 45; // la animación de entrada ya terminó

const CLAVES_DE_POSICION = ["position", "top", "bottom", "left", "right", "transform", "translate", "margin", "margin-top", "inset", "height", "width"];

function estilosDePosicion(html: string, nombre: string): Record<string, string> {
  const m = html.match(new RegExp(`data-estable="${nombre}"[^>]*?style="([^"]*)"`));
  if (!m) throw new Error(`No se encontró data-estable="${nombre}"`);
  return Object.fromEntries(
    m[1]
      .split(";")
      .map((d) => d.split(":").map((x) => x.trim()))
      .filter(([k]) => CLAVES_DE_POSICION.includes(k))
      .map(([k, v]) => [k, v])
  );
}

function enCuadro(fabrica: (frame: number) => ReactElement, frame: number): string {
  return renderToStaticMarkup(fabrica(frame));
}

function esperarEstable(fabrica: (frame: number) => ReactElement, nombres: string[]) {
  const antes = enCuadro(fabrica, ANTES);
  const despues = enCuadro(fabrica, DESPUES);
  for (const nombre of nombres) expect(estilosDePosicion(despues, nombre), nombre).toEqual(estilosDePosicion(antes, nombre));
  return { antes, despues };
}

describe("posición estable de lo ya visible", () => {
  for (const estilo of ["noche", "color_pleno", "foto"] as EstiloVisualId[]) {
    const paleta = paletaDeEstilo(estilo, TEMA);

    it(`comparación (${estilo}): la banda "Así no" no salta cuando entra "Así sí"`, () => {
      esperarEstable((frame) => createElement(ComparacionEstilo, { frame, fps: FPS, cuadroCambia: CAMBIO, tema: TEMA, paleta, textoMal: "Foto con flash", textoBien: "Luz de ventana" }), ["comparacion-mal"]);
    });

    it(`pantalla dividida (${estilo}): la mitad "mal" no salta`, () => {
      esperarEstable((frame) => createElement(PantallaDividida, { frame, fps: FPS, cuadroCambia: CAMBIO, tema: TEMA, paleta, textoMal: "Precio variable", textoBien: "Desde + monto real" }), ["dividida-mal"]);
    });

    it(`checklist (${estilo}): las filas no se mueven al marcarse`, () => {
      const items = ["Luz de ventana", "Fondo liso", "Producto en uso"];
      const { antes, despues } = esperarEstable(
        (frame) => createElement(ChecklistEstilo, { frame, fps: FPS, cuadroCambia: CAMBIO, tema: TEMA, paleta, titulo: "Antes de publicar", items }),
        ["checklist-0", "checklist-1", "checklist-2"]
      );
      expect((antes.match(/data-estable="checklist-/g) ?? []).length).toBe((despues.match(/data-estable="checklist-/g) ?? []).length);
    });
  }

  it("comparación de siempre (sin estilo): la tarjeta del error no salta", () => {
    esperarEstable((frame) => createElement(ComparacionVisual, { frame, fps: FPS, cuadroCambia: CAMBIO, tema: TEMA, textoMal: "Foto con flash", textoBien: "Luz de ventana" }), ["comparacion-clasica-mal"]);
  });

  it("celular: el número gigante no se corre cuando llegan notificaciones (su lugar está reservado)", () => {
    const fabrica = (frame: number) => createElement(CelularChat, { frame, fps: FPS, tema: TEMA, notificaciones: [CAMBIO, CAMBIO + 10], colorNumeroGigante: "#0F7A3C" });
    const { antes, despues } = esperarEstable(fabrica, ["celular-numero"]);
    const filas = (html: string) => (html.match(/Nuevo mensaje de un cliente/g) ?? []).length;
    expect(filas(antes)).toBe(filas(despues));
  });

  it("respuesta lenta: la pregunta del cliente no se mueve cuando llega la respuesta", () => {
    esperarEstable((frame) => createElement(RespuestaLentaVisual, { frame, fps: FPS, cuadroCambia: CAMBIO }), ["respuesta-pregunta"]);
  });
});
