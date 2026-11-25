// Escenario de la historia (revisión del episodio 1, 24 nov 2026): lo que
// el código sabe por la narración cambia lo que muestra el celular.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { escenarioDeNarracion } from "./validarPlan";
import { PantallaChat, PantallaFeed, PantallaPublicacion } from "./escenas/Pantallas";
import { recursosSinGenerar } from "../imagenesGeneradas";
import { piezasDeEscenario } from "../kit/fotosEscenario";
import type { PropsEscena } from "./escenas/tipos";

const base: PropsEscena = {
  frame: 0,
  fps: 30,
  d: {},
  paleta: { fondo: "#222", fondoProfundo: "#111", luz: "#fff" },
  tema: { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna", logo_url: null, nombre_marca: "Quiubot", instagramUsuario: "quiubot" },
  marca: { nombreTienda: "quiubot", colorMarca: "#534AB7", colorSecundario: "#B9B2FF", inicial: "Q", descripcionPerfil: null, chat: { cliente: ["Hola", "¿Precio?", "¡Lo quiero!"], respuesta: "¡Hola! Ya te ayudo" } },
  fotoUrl: "foto.png",
  recursos: recursosSinGenerar("foto.png"),
};
const texto = (props: PropsEscena, C: (p: PropsEscena) => unknown) => renderToStaticMarkup(createElement(C as never, props as never)).replace(/<[^>]+>/g, " ");

describe("escenario de la historia", () => {
  it("se saca de la narración: rubro ropa y si se habla de mensajes", () => {
    expect(escenarioDeNarracion([{ narracion: "Imagina que eres dueña de una tienda de ropa." }, { narracion: "Para que te escriban por WhatsApp." }])).toEqual({ rubro: "ropa", mensajes: true });
    expect(escenarioDeNarracion([{ narracion: "Pagas anuncios y nadie te compra." }])).toBeUndefined();
  });

  it("ropa: fotos ilustradas (perchero y alguien luciendo la ropa); sin rubro, ninguna", () => {
    expect(piezasDeEscenario("ropa").map((p) => p.clave)).toEqual(["foto:prendas", "foto:modelo"]);
    expect(piezasDeEscenario(undefined)).toEqual([]);
  });

  it("el chat de una tienda de ropa pregunta por la talla; sin rubro, los mensajes de siempre", () => {
    const d = { llega_mensaje: [0, 5, 10] };
    expect(texto({ ...base, frame: 60, d, escenario: { rubro: "ropa" } }, PantallaChat)).toMatch(/¿Hay talla M\?/);
    expect(texto({ ...base, frame: 60, d }, PantallaChat)).not.toMatch(/talla/);
  });

  it("la publicación propia: la cuenta de la marca (sin Patrocinado), los Me gusta suben y Promocionar se pulsa", () => {
    const d = { aparece: [0], suben_likes: [10], toca_promocionar: [70] };
    const antes = texto({ ...base, frame: 5, d, fotoPrendas: "prendas.png" }, PantallaPublicacion);
    expect(antes).toMatch(/quiubot/);
    expect(antes).not.toMatch(/Patrocinado/);
    expect(antes).toMatch(/96 Me gusta/);
    expect(antes).toMatch(/Promocionar/);
    const despues = texto({ ...base, frame: 90, d, fotoPrendas: "prendas.png" }, PantallaPublicacion);
    expect(despues).toMatch(/1\.204 Me gusta/);
    expect(despues).toMatch(/Promocionando/);
    expect(renderToStaticMarkup(createElement(PantallaPublicacion, { ...base, frame: 5, d, fotoPrendas: "prendas.png" }))).toContain("prendas.png");
  });

  it("el anuncio pide un mensaje si la historia habla de mensajes", () => {
    const d = { aparece_anuncio: [0] };
    expect(texto({ ...base, frame: 20, d, escenario: { mensajes: true } }, PantallaFeed)).toMatch(/Enviar mensaje/);
    expect(texto({ ...base, frame: 20, d }, PantallaFeed)).toMatch(/Comprar ahora/);
  });
});
