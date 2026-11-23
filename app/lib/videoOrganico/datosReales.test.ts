import { describe, expect, it } from "vitest";
import { erroresDatosDelGuion, fuentesDeDatosReales, textosQueSeDicenOMuestran } from "./datosReales";
import { construirPromptGuionOrganico, construirPromptGuionOrganicoConAudio, type EntradaGuionOrganico } from "@/video/promptGuionOrganico";
import { RECETAS_ORGANICAS } from "@/video/recetas/organico";

const SIN_DATOS = { tema: "vender más por WhatsApp", infoAdicionalMarca: "Plataforma de publicidad en Meta para pymes.", productos: [], productoPieza: null };

const guion = (narracion: string, textoArreglo = "Precio a la vista") => ({
  escenas: [
    { id: "e1", bloque: "gancho", tipo: "gancho_texto", narracion: "¿Nadie te escribe?", texto_gigante: "Nadie escribe", params: { texto: "¿Nadie te escribe?", palabra_clave: "escribe" } },
    { id: "e2", bloque: "valor", tipo: "lista_numerada", narracion, params: { titulo: "Consejo", items: ["uno", "dos", "tres"] }, visual: { tipo: "anuncio_boton", icono: "camara", etiqueta: "Anuncio", texto_problema: "Sin precio", texto_arreglo: textoArreglo, eventos: [{ palabra: 2, accion: "cambia_estado" }] } },
  ],
  bucle: { texto: "3 ajustes", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
  publicacion: { caption: "Escríbenos y te contamos." },
});

describe("datos reales en TODOS los guiones (tema corto incluido)", () => {
  it("tema corto sin precio: el guion no puede traer precio ni 'envío gratis' (ni en la voz ni en un visual)", () => {
    expect(erroresDatosDelGuion(guion("Pon tu precio: desde $45.000"), SIN_DATOS).join(" ")).toMatch(/\$45\.000/);
    expect(erroresDatosDelGuion(guion("Pon tu precio en el anuncio", "Envío gratis hoy"), SIN_DATOS).join(" ")).toMatch(/envío gratis/);
    expect(erroresDatosDelGuion(guion("Pon tu horario", "Abierto 8am-6pm"), SIN_DATOS).join(" ")).toMatch(/8am/);
  });

  it("un guion sin datos concretos pasa", () => {
    expect(erroresDatosDelGuion(guion("Pon tu precio en el anuncio"), SIN_DATOS)).toEqual([]);
  });

  it("el precio del producto o de la marca sí se puede decir", () => {
    const conProducto = { ...SIN_DATOS, productos: [{ nombre: "Plan Pro", tipo: "servicio" as const, destacar: null, precio_cop: 45000 }] };
    expect(erroresDatosDelGuion(guion("El Plan Pro cuesta $45.000"), conProducto)).toEqual([]);
    expect(fuentesDeDatosReales(conProducto)).toContain("$45.000");
  });

  it("un marcador sin reemplazar ([tu precio]) nunca llega al guion", () => {
    expect(erroresDatosDelGuion(guion("Pon [tu precio] en el anuncio"), SIN_DATOS).join(" ")).toMatch(/marcador \[tu precio\]/);
  });

  it("revisa la voz, la palabra gigante, los textos de escena, los visuales, el bucle y el caption (no los ids)", () => {
    const t = textosQueSeDicenOMuestran(guion("narración"));
    for (const esperado of ["narración", "Nadie escribe", "¿Nadie te escribe?", "Precio a la vista", "3 ajustes", "Escríbenos y te contamos."]) expect(t).toContain(esperado);
    expect(t).not.toContain("anuncio_boton");
    expect(t).not.toContain("e1");
  });
});

describe("los prompts orgánicos no traen ejemplos con datos concretos", () => {
  const entrada: EntradaGuionOrganico = {
    recetaId: "consejos_numerados",
    receta: RECETAS_ORGANICAS.consejos_numerados,
    duracionS: 16,
    infoAdicionalMarca: "Plataforma de publicidad en Meta para pymes.",
    adnTitular: "Marca",
    adnFraseCorta: "Frase",
    productos: [],
    tema: "vender más por WhatsApp",
    productoPieza: null,
    ganchoTipoAsignado: "pregunta",
    piezas: [],
    analisisPiezas: {},
  };
  it("sin precios, horarios, NxN ni 'envío gratis' de ejemplo (con voz y sin voz)", () => {
    for (const prompt of [construirPromptGuionOrganicoConAudio(entrada), construirPromptGuionOrganico({ ...entrada, recetaId: "mito_verdad", receta: RECETAS_ORGANICAS.mito_verdad })]) {
      expect(prompt).not.toMatch(/\$\s?\d/);
      expect(prompt).not.toMatch(/\b\d{1,2}\s?(?:am|pm|a\.\s?m\.|p\.\s?m\.)/i);
      expect(prompt).not.toMatch(/\b\d\s?x\s?\d\b/);
      expect(prompt).not.toMatch(/env[ií]o gratis/i);
    }
  });
});
