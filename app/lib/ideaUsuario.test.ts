import { describe, expect, it } from "vitest";
import { LIMITE_IDEA, clasificarIdea, detectarDatosInventados, proponerSerie, puntosDeLaIdea, verificarIdeaRespetada } from "./ideaUsuario";
import { CrearPiezaManualSchema } from "./contenido";

const IDEA_TALLAS = `Mucha gente compra la talla equivocada por internet.
1. Mide tu prenda favorita, no tu cuerpo.
2. Compara con nuestra tabla de tallas.
3. Si quedas entre dos, elige la más grande.
Ejemplo: a Laura le pasó con un jean.
Cierre: "Escríbenos tus medidas y te decimos tu talla."`;

describe("clasificarIdea", () => {
  it("un tema corto se genera como siempre; un texto desarrollado es una idea que el reel sigue", () => {
    expect(clasificarIdea("cómo elegir la talla correcta")).toBe("tema");
    expect(clasificarIdea("")).toBe("vacia");
    expect(clasificarIdea(IDEA_TALLAS)).toBe("idea");
    expect(clasificarIdea("Quiero un reel que explique por qué la gente abandona el carrito cuando ve el costo del envío al final y qué hacer para evitarlo con tres cambios simples en la tienda")).toBe("idea");
  });
});

describe("puntos de la idea", () => {
  it("toma los puntos marcados con números, viñetas u ordinales", () => {
    expect(puntosDeLaIdea(IDEA_TALLAS)).toEqual(["Mide tu prenda favorita, no tu cuerpo.", "Compara con nuestra tabla de tallas.", "Si quedas entre dos, elige la más grande."]);
    expect(puntosDeLaIdea("Intro\n- uno largo\n• dos largo\nPrimero: tres largo")).toEqual(["uno largo", "dos largo", "tres largo"]);
  });
});

describe("idea demasiado larga -> propuesta de serie (nunca se recorta en silencio)", () => {
  it("hasta 3 puntos cabe en un reel", () => {
    expect(proponerSerie(IDEA_TALLAS)).toBe("cabe");
  });

  it("5 puntos: 2 reels con TODOS los puntos en su orden, la introducción en cada uno y el cierre en el último", () => {
    const idea = `Errores al vender por WhatsApp.\n1. Tardar en responder\n2. No saludar por el nombre\n3. Mandar audios largos\n4. No dar el precio\n5. No hacer seguimiento\nCierre: "Responde hoy mismo."`;
    const p = proponerSerie(idea);
    if (p === null || p === "cabe") throw new Error("debía proponer una serie");
    expect(p.partes).toHaveLength(2);
    expect(p.motivo).toMatch(/5 puntos/);
    const todas = p.partes.map((x) => x.idea).join("\n");
    const orden = ["Tardar en responder", "No saludar", "Mandar audios", "No dar el precio", "No hacer seguimiento"].map((t) => todas.indexOf(t));
    expect(orden.every((x, i) => x >= 0 && (i === 0 || x > orden[i - 1]))).toBe(true);
    expect(p.partes.every((x) => x.idea.includes("Errores al vender por WhatsApp."))).toBe(true);
    expect(p.partes[1].idea).toContain("Responde hoy mismo.");
    expect(p.partes[0].idea).not.toContain("Responde hoy mismo.");
    expect(p.partes[0].idea.startsWith("Parte 1 de 2")).toBe(true);
  });

  it("más de 9 puntos no caben ni en una serie de 3: null (hay que acortarla)", () => {
    expect(proponerSerie(Array.from({ length: 10 }, (_, i) => `${i + 1}. punto número ${i + 1}`).join("\n"))).toBeNull();
  });
});

describe("idea larga respetada: sus puntos aparecen en el guion, en su orden", () => {
  const guionBueno = ["Compras talla equivocada?", "Primero, mide tu prenda favorita.", "Segundo, compárala con nuestra tabla de tallas.", "Tercero, si quedas entre dos, elige la más grande.", "Escríbenos tus medidas y te decimos tu talla."];
  it("guion que sigue los puntos en orden: sin problemas", () => {
    expect(verificarIdeaRespetada(IDEA_TALLAS, guionBueno)).toEqual([]);
  });
  it("si falta un punto o cambia el orden, lo dice para el reintento", () => {
    expect(verificarIdeaRespetada(IDEA_TALLAS, [guionBueno[0], guionBueno[1], guionBueno[3]]).join(" ")).toMatch(/punto 2 .*no aparece/);
    expect(verificarIdeaRespetada(IDEA_TALLAS, [guionBueno[0], guionBueno[3], guionBueno[2], guionBueno[1]]).join(" ")).toMatch(/respeta el orden/);
  });
});

describe("datos del usuario permitidos vs datos inventados", () => {
  const idea = "Promo de diciembre: jean a $89.900 con envío gratis. Atendemos de 8 a. m. a 6 p. m.";
  it("lo que el usuario escribió en su idea se puede decir y mostrar", () => {
    expect(detectarDatosInventados(["El jean está a $89.900 y el envío gratis.", "Te atendemos desde las 8 a. m."], idea)).toEqual([]);
  });
  it("lo que no escribió (ni está en la marca) se rechaza", () => {
    const p = detectarDatosInventados(["Llévalo a $79.900", "con 20% de descuento", "y 2x1 este fin de semana"], idea);
    expect(p.join(" ")).toMatch(/\$79\.900/);
    expect(p.join(" ")).toMatch(/20 ?%/);
    expect(p.join(" ")).toMatch(/2x1/);
  });
  it("sin datos en la idea, prometer envío gratis o una garantía concreta es inventar", () => {
    expect(detectarDatosInventados(["Con envío gratis y garantía de 1 año"], "cómo elegir la talla").length).toBe(2);
  });
});

describe("límites del campo", () => {
  it(`el servidor acepta hasta ${LIMITE_IDEA} caracteres y rechaza más`, () => {
    const base = { receta_organica: "consejos_numerados", programada_para: new Date(Date.now() + 86400e3).toISOString() };
    expect(CrearPiezaManualSchema.safeParse({ ...base, tema: "a".repeat(LIMITE_IDEA) }).success).toBe(true);
    expect(CrearPiezaManualSchema.safeParse({ ...base, tema: "a".repeat(LIMITE_IDEA + 1) }).success).toBe(false);
  });
});

// Riesgo anotado (24 nov 2026): nombrar un concepto en un consejo no es
// un dato. Solo se bloquean datos u ofertas CONCRETAS que nadie dio.
describe("concepto mencionado vs dato concreto", () => {
  const SIN_DATOS = "cómo vender más por WhatsApp. Plataforma de publicidad en Meta para pymes.";

  it("mencionar el concepto pasa (descuentos, garantía, cuotas, horario, envío, entrega)", () => {
    const consejos = [
      "No regales descuentos sin una razón.",
      "Explica tu garantía en la descripción.",
      "Ofrece cuotas si vendes productos caros.",
      "Publica tu horario de atención en el perfil.",
      "Cuenta cómo funcionan tus envíos.",
      "Di cuánto se demora la entrega.",
      "Si tienes descuento, ponlo arriba.",
    ];
    for (const c of consejos) expect(detectarDatosInventados([c], SIN_DATOS), c).toEqual([]);
  });

  it("un dato u oferta concreta que nadie dio se rechaza", () => {
    const casos: [string, RegExp][] = [
      ["Pon tu jean a $89.900", /\$89\.900/],
      ["Llévalo con 20% de descuento", /20 ?%/],
      ["Aprovecha el 2x1 de esta semana", /2x1/],
      ["Te damos garantía de 1 año", /garantía de 1 año/],
      ["Págalo en 12 cuotas", /12 cuotas/],
      ["Págalo en cuotas sin interés", /cuotas sin interés/],
      ["Con envío gratis a todo el país", /envío gratis/],
      ["La entrega es en 24 horas", /24 horas/],
      ["Atendemos de 8 a 6", /de 8 a 6/],
      ["Abierto 24/7", /24 ?\/ ?7/],
      ["Abrimos a las 9 am", /9 am/],
    ];
    for (const [texto, motivo] of casos) {
      const p = detectarDatosInventados([texto], SIN_DATOS);
      expect(p.length, texto).toBeGreaterThan(0);
      expect(p.join(" "), texto).toMatch(motivo);
    }
  });

  it("el mismo dato concreto escrito por el usuario (o en la marca) pasa", () => {
    const delUsuario = "Garantía de 1 año, hasta 12 cuotas sin interés, envío gratis, entrega en 24 horas, atendemos de 8 a 6 y 2x1 los martes.";
    const guion = ["Te damos garantía de 1 año", "Págalo en 12 cuotas sin interés", "Con envío gratis", "La entrega es en 24 horas", "Atendemos de 8 a 6", "Aprovecha el 2x1"];
    expect(detectarDatosInventados(guion, delUsuario)).toEqual([]);
  });
});

