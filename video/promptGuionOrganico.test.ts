// Prompt del reel con voz (consejos_numerados): el tema y el producto
// de la pieza tienen que llegar como EJE del reel (18 nov 2026, caso
// real: los reels salían con los mismos 3 consejos sin importar el
// tema). Con OpenAI mockeado, "dos temas dan narraciones distintas" no
// se puede probar de verdad -- eso se prueba en staging con el modelo
// real. Lo que sí se prueba acá: qué le llega al modelo.
import { describe, it, expect } from "vitest";
import { construirPromptGuionOrganicoConAudio, seccionEjeDelReel, type EntradaGuionOrganico } from "./promptGuionOrganico";
import { RECETAS_ORGANICAS } from "./recetas/organico";

function entrada(extra: Partial<EntradaGuionOrganico> = {}): EntradaGuionOrganico {
  return {
    recetaId: "consejos_numerados",
    receta: RECETAS_ORGANICAS.consejos_numerados,
    duracionS: 30,
    infoAdicionalMarca: "Tienda de cerámica hecha a mano en Medellín, vendemos por Instagram.",
    adnTitular: "Cerámica con alma",
    adnFraseCorta: "Hecho a mano",
    productos: [{ nombre: "Taza artesanal", tipo: "producto", destacar: null, precio_cop: 45000 }],
    tema: null,
    productoPieza: null,
    ganchoTipoAsignado: "pregunta",
    piezas: [],
    analisisPiezas: {},
    ...extra,
  };
}

describe("eje del reel: tema y producto de la pieza", () => {
  it("el tema pedido llega como eje del reel, antes de la estructura de la receta", () => {
    const prompt = construirPromptGuionOrganicoConAudio(entrada({ tema: "fotos de producto" }));
    const iEje = prompt.indexOf("EJE DEL REEL");
    expect(iEje).toBeGreaterThan(-1);
    expect(prompt).toContain('TEMA PEDIDO PARA ESTA PIEZA: "fotos de producto"');
    expect(iEje).toBeLessThan(prompt.indexOf("ESTRUCTURA OBLIGATORIA"));
  });

  it("dos temas distintos producen prompts con ejes distintos", () => {
    const a = seccionEjeDelReel({ tema: "fotos de producto", productoPieza: null });
    const b = seccionEjeDelReel({ tema: "cómo poner precios", productoPieza: null });
    expect(a).not.toBe(b);
    expect(a).toContain("fotos de producto");
    expect(b).toContain("cómo poner precios");
  });

  it("el producto de la pieza llega como eje (nombre, precio y lo que lo hace especial)", () => {
    const prompt = construirPromptGuionOrganicoConAudio(
      entrada({ productoPieza: { nombre: "Jarrón esmaltado", tipo: "producto", destacar: "esmalte azul cobalto", precio_cop: 120000 } })
    );
    const eje = prompt.slice(prompt.indexOf("EJE DEL REEL"), prompt.indexOf("ESTRUCTURA OBLIGATORIA"));
    expect(eje).toContain("PRODUCTO DE ESTA PIEZA: Jarrón esmaltado");
    expect(eje).toContain("esmalte azul cobalto");
    expect(eje).toContain("120.000");
  });

  it("tema + producto: los consejos son del tema, aplicados al producto", () => {
    const eje = seccionEjeDelReel({ tema: "fotos de producto", productoPieza: { nombre: "Taza artesanal", tipo: "producto", destacar: null, precio_cop: null } });
    expect(eje).toContain("fotos de producto");
    expect(eje).toContain("Los consejos se aplican a este producto");
  });

  it("servicio: lo nombra como servicio", () => {
    const eje = seccionEjeDelReel({ tema: null, productoPieza: { nombre: "Clase de torno", tipo: "servicio", destacar: null, precio_cop: null } });
    expect(eje).toContain("SERVICIO DE ESTA PIEZA: Clase de torno");
  });

  it("sin tema ni producto: pide un tema concreto del rubro real, nunca uno genérico", () => {
    const eje = seccionEjeDelReel({ tema: null, productoPieza: null });
    expect(eje).toContain("rubro real de este negocio");
    expect(eje).toContain("Nunca un tema genérico");
  });

  it("tema vacío o solo espacios cuenta como sin tema", () => {
    expect(seccionEjeDelReel({ tema: "   ", productoPieza: null })).not.toContain("TEMA PEDIDO");
  });

  it("los consejos se deciden desde el eje, antes que el visual (el prompt no los amarra a un visual)", () => {
    const prompt = construirPromptGuionOrganicoConAudio(entrada({ tema: "fotos de producto" }));
    expect(prompt).toContain("primero decide los consejos a partir del eje");
    expect(prompt).toContain("Nunca elijas un consejo porque calza con un visual disponible");
  });

  it("el prompt ofrece todos los visuales de 2 estados para los consejos, cada uno con sus textos", () => {
    const prompt = construirPromptGuionOrganicoConAudio(entrada({ tema: "fotos de producto" }));
    for (const tipo of ["comparacion", "icono_palabra", "anuncio_boton", "respuesta_lenta", "conexion_whatsapp", "contador"]) {
      expect(prompt).toContain(tipo);
    }
    expect(prompt).not.toContain('Para el consejo "pon un botón de contacto en tu anuncio"');
    expect(prompt).not.toContain('Para el consejo "responde rápido"');
  });
});
