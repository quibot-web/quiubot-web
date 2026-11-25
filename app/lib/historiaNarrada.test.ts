import { describe, expect, it } from "vitest";
import { GuionSchema } from "@/video/guion.schema";
import { validarPlanIlustrado, accionesDisponiblesTexto } from "@/video/ilustrado/motor/validarPlan";
import { frasesDelCartel, guionDesdeHistoria, pareceHistoria, problemasDeLaHistoria, terminaEnOpciones, type RespuestaHistoria } from "./historiaNarrada";

// El episodio 1 de la tienda de ropa (pedido del 24 nov 2026).
const TEXTO =
  "Imagina que eres dueña de una tienda de ropa. Tienes 300.000 pesos para anuncios este mes y una sola oportunidad. Opción A: promocionar la publicación que más likes tuvo, con el botón 'Promocionar'. Opción B: crear un anuncio nuevo, mostrando la ropa puesta, para que te escriban por WhatsApp. ¿Qué harías tú? Comenta A o B, y el próximo video sigue con la que más votos tenga.";
const BUENA: RespuestaHistoria = {
  frases: [
    "Imagina que eres dueña de una tienda de ropa.",
    "Tienes trescientos mil pesos para anuncios este mes y una sola oportunidad.",
    "Opción A: promocionar la publicación que más likes tuvo, con el botón Promocionar.",
    "Opción B: crear un anuncio nuevo, mostrando la ropa puesta, para que te escriban por WhatsApp.",
    "¿Qué harías tú?",
    "Comenta A o B, y el próximo video sigue con la que más votos tenga.",
  ],
  opciones: { a: "Promocionar el post", b: "Anuncio nuevo a WhatsApp", pregunta_en: 4 },
  caption: "Imagina que eres dueña de una tienda de ropa... ¿A o B? Comenta.",
  hashtags: ["#tiendaderopa", "#anuncios", "#emprendedoras"],
};
const tema = { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna", logo_url: null, nombre_marca: "Quiubot", instagramUsuario: "quiubot" } as const;

describe("Historia narrada: cuándo sugerirla", () => {
  it("un relato que empieza con 'Imagina' o termina en A o B parece historia; un tema corto no", () => {
    expect(pareceHistoria(TEXTO)).toBe(true);
    expect(pareceHistoria("Imagínate que mañana abres tu tienda")).toBe(true);
    expect(pareceHistoria("fotos de producto")).toBe(false);
    expect(pareceHistoria("")).toBe(false);
    expect(terminaEnOpciones(TEXTO)).toBe(true);
    expect(terminaEnOpciones("Imagina que eres dueña de una tienda.")).toBe(false);
  });
});

describe("Historia narrada: la IA sigue el texto del usuario", () => {
  it("la adaptación fiel (números en letras, sus frases en su orden, con opciones) pasa", () => {
    expect(problemasDeLaHistoria(TEXTO, BUENA)).toEqual([]);
  });

  it("cambiar el orden, volverlo consejos numerados, dejar dígitos o agregar ideas se rechaza", () => {
    const f = BUENA.frases;
    const reordenada = { ...BUENA, frases: [f[0], f[3], f[2], f[1], f[4], f[5]], opciones: { ...BUENA.opciones!, pregunta_en: 4 } };
    expect(problemasDeLaHistoria(TEXTO, reordenada).join(" ")).toMatch(/orden/);
    const numerada = { ...BUENA, frases: [f[0], "Consejo uno: tienes trescientos mil pesos para anuncios este mes.", ...f.slice(2)] };
    expect(problemasDeLaHistoria(TEXTO, numerada).join(" ")).toMatch(/consejo numerado/);
    const conDigitos = { ...BUENA, frases: [f[0], "Tienes 300.000 pesos para anuncios este mes y una sola oportunidad.", ...f.slice(2)] };
    expect(problemasDeLaHistoria(TEXTO, conDigitos).join(" ")).toMatch(/dígitos/);
    const inventada = { ...BUENA, frases: [f[0], f[1], "Tus clientas compran más los viernes después del almuerzo laboral.", ...f.slice(2)], opciones: { ...BUENA.opciones!, pregunta_en: 5 } };
    expect(problemasDeLaHistoria(TEXTO, inventada).join(" ")).toMatch(/agrega cosas/);
    const sinFrase = { ...BUENA, frases: [f[0], f[2], f[3], f[4], f[5]], opciones: { ...BUENA.opciones!, pregunta_en: 3 } };
    expect(problemasDeLaHistoria(TEXTO, sinFrase).join(" ")).toMatch(/Falta/);
  });

  it("si el texto pide A o B, las opciones son obligatorias y cortas; si no, van en null", () => {
    expect(problemasDeLaHistoria(TEXTO, { ...BUENA, opciones: null }).join(" ")).toMatch(/Faltan "opciones"/);
    expect(problemasDeLaHistoria(TEXTO, { ...BUENA, opciones: { ...BUENA.opciones!, a: "Promocionar la publicación con más likes" } }).join(" ")).toMatch(/máximo 30/);
    expect(problemasDeLaHistoria(TEXTO, { ...BUENA, opciones: { ...BUENA.opciones!, pregunta_en: 5 } }).join(" ")).toMatch(/pregunta_en/);
    const sinOpciones = "Imagina que eres dueña de una tienda de ropa. Un día llega una clienta buscando un vestido azul. Se lo muestras puesto y lo compra feliz.";
    const r: RespuestaHistoria = { frases: ["Imagina que eres dueña de una tienda de ropa.", "Un día llega una clienta buscando un vestido azul.", "Se lo muestras puesto y lo compra feliz."], opciones: { a: "x", b: "y", pregunta_en: 1 }, caption: "c", hashtags: [] };
    expect(problemasDeLaHistoria(sinOpciones, r).join(" ")).toMatch(/va en null/);
    expect(problemasDeLaHistoria(sinOpciones, { ...r, opciones: null })).toEqual([]);
  });
});

describe("Historia narrada: el guion y el cartel", () => {
  it("el código arma un guion válido: una escena por frase, la pregunta con sus opciones y el cierre para comentar", () => {
    const g = GuionSchema.parse(guionDesdeHistoria(BUENA, { tema, ganchoTipo: "pregunta", pistaId: null, hashtags: null }));
    expect(g.receta_organica).toBe("historia_narrada");
    expect(g.escenas.map((e) => e.narracion)).toEqual(BUENA.frases);
    expect(g.escenas[0].bloque).toBe("gancho");
    expect(g.escenas[4].tipo).toBe("dos_opciones");
    const ultima = g.escenas.at(-1)!;
    expect(ultima.tipo === "cta" && ultima.params.accion).toBe("comentar");
    // Sin opciones: cierra con "Seguir" a la cuenta.
    const sin = GuionSchema.parse(guionDesdeHistoria({ ...BUENA, frases: BUENA.frases.slice(0, 4), opciones: null }, { tema, ganchoTipo: "pregunta", pistaId: null, hashtags: null }));
    const cierre = sin.escenas.at(-1)!;
    expect(cierre.tipo === "cta" && cierre.params.accion).toBe("seguir");
  });

  it("el cartel aparece en la pregunta y resalta A y B cuando la voz las nombra", () => {
    const escenas = BUENA.frases.map((n, i) => ({ id: `e${i + 1}`, narracion: n }));
    const [pregunta, invitacion] = frasesDelCartel(escenas, 4);
    expect(pregunta).toEqual({ escena_id: "e5", acciones: [{ escena: "opciones", accion: "aparece", palabra: 0 }] });
    const palabras = escenas[5].narracion.split(/\s+/);
    const de = (accion: string) => invitacion.acciones.find((a) => a.accion === accion)!.palabra;
    const limpia = (p: string) => p.replace(/[^A-Za-z]/g, "");
    expect(limpia(palabras[de("resalta_a")])).toBe("A");
    expect(limpia(palabras[de("resalta_b")])).toBe("B");
    expect(de("comenta")).toBe(0);
  });

  it("la IA no ve ni puede usar el cartel: solo lo pone el código", () => {
    expect(accionesDisponiblesTexto()).not.toMatch(/opciones/);
    const escenas = [{ id: "e1", narracion: "Uno dos tres cuatro" }];
    const plan = { frases: [{ escena_id: "e1", acciones: [{ escena: "opciones", accion: "aparece", palabra: 0 }] }] };
    expect(validarPlanIlustrado(plan, escenas).join(" ")).toMatch(/"opciones" no está disponible/);
    expect(validarPlanIlustrado({ ...plan, opciones: { a: "x", b: "y" } }, escenas).join(" ")).not.toMatch(/no está disponible/);
  });
});
