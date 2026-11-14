// Pura, sin red -- confirma lunesDeLaSemana() (el agrupador real del
// calendario de /contenido) contra fechas reales conocidas,
// formatoFechaLarga() contra el formato pedido explícitamente, y que
// CrearPiezaManualSchema exige los campos reales de "Agregar reel" --
// incluida la fecha/hora futura (caso real: una pieza quedó
// programada para un día que ya había pasado).
import { describe, it, expect } from "vitest";
import { lunesDeLaSemana, labelReceta, formatoFechaLarga, esFechaFutura, elegirGanchoTipoMenosUsado, CrearPiezaManualSchema } from "./contenido";

// Relativas a "ahora" (no fechas fijas como "2026-11-20") -- estas
// pruebas tienen que seguir pasando sin importar qué día se corran de
// verdad, nunca solo mientras dure esta sesión.
function isoEnElFuturo(horas: number): string {
  return new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
}
function isoEnElPasado(horas: number): string {
  return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
}

describe("lunesDeLaSemana", () => {
  it("un miércoles cae en el lunes de esa misma semana", () => {
    expect(lunesDeLaSemana("2026-11-11")).toBe("2026-11-09");
  });

  it("el propio lunes se devuelve a sí mismo", () => {
    expect(lunesDeLaSemana("2026-11-09")).toBe("2026-11-09");
  });

  it("un domingo cae en el lunes de la semana que está terminando, no en el que sigue", () => {
    expect(lunesDeLaSemana("2026-11-15")).toBe("2026-11-09");
  });

  it("el lunes siguiente ya es otra semana", () => {
    expect(lunesDeLaSemana("2026-11-16")).toBe("2026-11-16");
  });
});

describe("labelReceta", () => {
  it("devuelve la etiqueta real de una receta conocida", () => {
    expect(labelReceta("mito_verdad")).toBe("Mito o verdad");
  });
});

describe("formatoFechaLarga", () => {
  it("arma 'día-corto día-del-mes mes · hora' en español, hora de Bogotá", () => {
    expect(formatoFechaLarga("2026-11-09T12:00:00-05:00")).toBe("lun 9 nov · 12:00 p. m.");
  });

  it("hora de la tarde: p. m.", () => {
    expect(formatoFechaLarga("2026-11-16T15:00:00-05:00")).toBe("lun 16 nov · 3:00 p. m.");
  });
});

describe("esFechaFutura", () => {
  it("una hora en el futuro: true", () => {
    expect(esFechaFutura(isoEnElFuturo(1))).toBe(true);
  });

  it("una hora en el pasado: false", () => {
    expect(esFechaFutura(isoEnElPasado(1))).toBe(false);
  });

  it("un texto que no es fecha: false, nunca lanza", () => {
    expect(esFechaFutura("no es una fecha")).toBe(false);
  });
});

describe("CrearPiezaManualSchema", () => {
  it("acepta una pieza manual válida", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "consejos_numerados", programada_para: isoEnElFuturo(48) });
    expect(r.success).toBe(true);
  });

  it("rechaza una receta que no existe", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "inventada", programada_para: isoEnElFuturo(48) });
    expect(r.success).toBe(false);
  });

  it("rechaza una fecha sin offset de zona horaria", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "consejos_numerados", programada_para: "no es una fecha" });
    expect(r.success).toBe(false);
  });

  it("rechaza una fecha/hora ya pasada (caso real que motivó esta validación)", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "consejos_numerados", programada_para: isoEnElPasado(5 * 24) });
    expect(r.success).toBe(false);
  });

  it("producto_en_uso sin ninguna pieza del álbum: rechazada", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "producto_en_uso", programada_para: isoEnElFuturo(48) });
    expect(r.success).toBe(false);
  });

  it("producto_en_uso con al menos una pieza: aceptada", () => {
    const r = CrearPiezaManualSchema.safeParse({
      receta_organica: "producto_en_uso",
      programada_para: isoEnElFuturo(48),
      media_ids: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(r.success).toBe(true);
  });

  it("una receta que no exige media, sin piezas: sigue aceptada", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "mito_verdad", programada_para: isoEnElFuturo(48) });
    expect(r.success).toBe(true);
  });

  it("acepta un tema opcional", () => {
    const r = CrearPiezaManualSchema.safeParse({
      receta_organica: "mito_verdad",
      programada_para: isoEnElFuturo(48),
      tema: "por qué tus anuncios no traen mensajes",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tema).toBe("por qué tus anuncios no traen mensajes");
  });

  it("sin tema: sigue aceptada (es opcional)", () => {
    const r = CrearPiezaManualSchema.safeParse({ receta_organica: "mito_verdad", programada_para: isoEnElFuturo(48) });
    expect(r.success).toBe(true);
  });

  it("rechaza un tema de más de 200 caracteres", () => {
    const r = CrearPiezaManualSchema.safeParse({
      receta_organica: "mito_verdad",
      programada_para: isoEnElFuturo(48),
      tema: "x".repeat(201),
    });
    expect(r.success).toBe(false);
  });
});

describe("elegirGanchoTipoMenosUsado", () => {
  it("semana vacía: elige el primero de la lista fija (empate, determinista)", () => {
    expect(elegirGanchoTipoMenosUsado([])).toBe("pregunta");
  });

  it("elige el tipo que menos se repitió, no el primero", () => {
    // "pregunta" ya se usó 2 veces, "error_comun" 1 vez, el resto 0 --
    // con empate entre varios en 0, gana el primero de la lista fija.
    const resultado = elegirGanchoTipoMenosUsado(["pregunta", "pregunta", "error_comun"]);
    expect(resultado).not.toBe("pregunta");
    expect(resultado).not.toBe("error_comun");
  });

  it("ignora valores null/undefined/inválidos sin romperse", () => {
    expect(elegirGanchoTipoMenosUsado([null, undefined, "no_es_un_tipo", "pregunta"])).not.toBe("pregunta");
  });

  it("si los 6 tipos ya se usaron igual de veces, elige el primero de la lista fija", () => {
    const todos = ["pregunta", "dato_sorprendente", "error_comun", "afirmacion_fuerte", "antes_despues", "nadie_te_dice_que"];
    expect(elegirGanchoTipoMenosUsado(todos)).toBe("pregunta");
  });
});
