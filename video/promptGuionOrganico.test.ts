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
    const prompt = construirPromptGuionOrganicoConAudio(entrada({ tema: "fotos de producto", piezas: [{ id: "foto-1", tipo: "imagen" }] }));
    expect(prompt).toContain("hay 8 y son los ÚNICOS válidos para un consejo");
    for (const tipo of ["comparacion", "icono_palabra", "checklist", "comparacion_foto", "anuncio_boton", "respuesta_lenta", "conexion_whatsapp", "contador"]) {
      expect(prompt).toContain(tipo);
    }
    expect(prompt).not.toContain('Para el consejo "pon un botón de contacto en tu anuncio"');
    expect(prompt).not.toContain('Para el consejo "responde rápido"');
  });

  it("parte 2e: sin fotos en la pieza, comparacion_foto ni se ofrece (7 opciones)", () => {
    for (const piezas of [[], [{ id: "video-1", tipo: "video" as const }]]) {
      const prompt = construirPromptGuionOrganicoConAudio(entrada({ tema: "precios", piezas }));
      expect(prompt).not.toContain("comparacion_foto");
      expect(prompt).toContain("hay 7 y son los ÚNICOS válidos para un consejo");
      expect(prompt).not.toContain("{{");
    }
  });

  it("parte 2e: gancho y cierre ya no están amarrados a celular_chat", () => {
    const prompt = construirPromptGuionOrganicoConAudio(entrada({ tema: "precios" }));
    expect(prompt).toContain('Un visual de 2 estados');
    expect(prompt).toContain("se queda quieto en su estado \"problema\"");
    expect(prompt).toContain("SOLO si el eje es sobre recibir mensajes o clientes");
    expect(prompt).toContain("CIERRA EL BUCLE con el MISMO visual del gancho");
    expect(prompt).not.toContain('vuelve a visual "celular_chat", el MISMO tipo que el gancho');
  });
});

describe("tu idea para el video en el prompt (24 nov 2026)", () => {
  it("idea desarrollada: el prompt la cita entera y pide seguir sus puntos en orden, usar solo sus datos y proponer una serie si no cabe", () => {
    const idea = "Mucha gente compra la talla equivocada.\n1. Mide tu prenda favorita.\n2. Compara con la tabla.\nEl jean está a $89.900.";
    const s = seccionEjeDelReel({ tema: idea, productoPieza: null });
    expect(s).toContain(idea);
    expect(s).toMatch(/en SU orden/);
    expect(s).toMatch(/NO agregues puntos que el usuario no pidió/);
    expect(s).toMatch(/datos REALES de la marca/);
    expect(s).toMatch(/"no_cabe": true/);
  });
  it("tema corto: como siempre", () => {
    const s = seccionEjeDelReel({ tema: "cómo elegir la talla", productoPieza: null });
    expect(s).toMatch(/TEMA PEDIDO PARA ESTA PIEZA: "cómo elegir la talla"/);
    expect(s).not.toMatch(/no_cabe/);
  });
});
