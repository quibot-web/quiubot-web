// Solo para el generador y la prueba (Node): el SVG de origen de cada
// imagen fija (con xmlns) y su huella.
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ESCALA_POST_FIJO, IMAGENES_FIJAS, type NombreImagenFija, type TipoPostFijo } from "./imagenesFijas";
import { Post } from "./Objetos";

export function markupImagenFija(nombre: NombreImagenFija): string {
  const html = renderToStaticMarkup(IMAGENES_FIJAS[nombre].dibujo);
  return html.startsWith("<svg xmlns") ? html : html.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');
}

export function huellaImagenFija(nombre: NombreImagenFija): string {
  return createHash("sha256").update(`${IMAGENES_FIJAS[nombre].ancho}|${markupImagenFija(nombre)}`).digest("hex").slice(0, 16);
}

// Huella del HTML de una publicación genérica (si cambia, hay que volver
// a generar su PNG). Incluye las huellas de las imágenes que usa.
export function huellaPostFijo(tipo: TipoPostFijo): string {
  const html = renderToStaticMarkup(createElement(Post, { tipo, indice: 0, fotoUrl: "", colorMarca: "#000000", comoHtml: true }));
  const dependencias = (Object.keys(IMAGENES_FIJAS) as NombreImagenFija[]).filter((n) => html.includes(`ilustrado/${n}.png`)).map(huellaImagenFija);
  return createHash("sha256").update(`${ESCALA_POST_FIJO}|${html}|${dependencias.join(",")}`).digest("hex").slice(0, 16);
}
