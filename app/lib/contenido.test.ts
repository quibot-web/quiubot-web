// Pura, sin red -- confirma lunesDeLaSemana() (el agrupador real del
// calendario de /contenido) contra fechas reales conocidas,
// formatoFechaLarga() contra el formato pedido explícitamente, y que
// CrearPiezaManualSchema exige los campos reales de "Agregar reel" --
// incluida la fecha/hora futura (caso real: una pieza quedó
// programada para un día que ya había pasado).
import { describe, it, expect } from "vitest";
import {
  lunesDeLaSemana,
  labelReceta,
  formatoFechaLarga,
  esFechaFutura,
  elegirGanchoTipoMenosUsado,
  piezaSinVideoProxima,
  idsQuePrometenParte2SinCumplir,
  elegirPistaMusicalOrganica,
  CrearPiezaManualSchema,
} from "./contenido";

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

  it("rechaza una idea de más de 1500 caracteres (antes el tema tenía 200)", () => {
    const r = CrearPiezaManualSchema.safeParse({
      receta_organica: "mito_verdad",
      programada_para: isoEnElFuturo(48),
      tema: "x".repeat(1501),
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

describe("piezaSinVideoProxima (aviso 2h antes sin video)", () => {
  const AHORA = new Date("2026-11-14T12:00:00-05:00");

  it("aprobada, falta 1h: true", () => {
    const pieza = { estado: "aprobada" as const, programada_para: "2026-11-14T13:00:00-05:00" };
    expect(piezaSinVideoProxima(pieza, AHORA)).toBe(true);
  });

  it("renderizando, falta 1h: true", () => {
    const pieza = { estado: "renderizando" as const, programada_para: "2026-11-14T13:00:00-05:00" };
    expect(piezaSinVideoProxima(pieza, AHORA)).toBe(true);
  });

  it("falta más de 2h: false", () => {
    const pieza = { estado: "aprobada" as const, programada_para: "2026-11-14T15:00:00-05:00" };
    expect(piezaSinVideoProxima(pieza, AHORA)).toBe(false);
  });

  it("ya pasó la hora: false (eso ya es 'vencida', no este aviso)", () => {
    const pieza = { estado: "aprobada" as const, programada_para: "2026-11-14T11:00:00-05:00" };
    expect(piezaSinVideoProxima(pieza, AHORA)).toBe(false);
  });

  it("ya tiene video (lista): false, sin importar la hora", () => {
    const pieza = { estado: "lista" as const, programada_para: "2026-11-14T12:30:00-05:00" };
    expect(piezaSinVideoProxima(pieza, AHORA)).toBe(false);
  });
});

describe("idsQuePrometenParte2SinCumplir", () => {
  it("serie_partes sin ninguna otra pieza que la continúe: promete sin cumplir", () => {
    const piezas = [{ id: "parte-1", receta_organica: "serie_partes" as const, continua_de_id: null }];
    expect(idsQuePrometenParte2SinCumplir(piezas)).toEqual(new Set(["parte-1"]));
  });

  it("serie_partes con su parte 2 en el calendario: no promete nada pendiente", () => {
    const piezas = [
      { id: "parte-1", receta_organica: "serie_partes" as const, continua_de_id: null },
      { id: "parte-2", receta_organica: "serie_partes" as const, continua_de_id: "parte-1" },
    ];
    expect(idsQuePrometenParte2SinCumplir(piezas)).toEqual(new Set());
  });

  it("la propia parte 2 nunca se marca a sí misma (ella es la continuación, no la que promete)", () => {
    const piezas = [{ id: "parte-2", receta_organica: "serie_partes" as const, continua_de_id: "parte-1-borrada" }];
    expect(idsQuePrometenParte2SinCumplir(piezas)).toEqual(new Set());
  });

  it("recetas que no son serie_partes: nunca se marcan", () => {
    const piezas = [{ id: "otra", receta_organica: "mito_verdad" as const, continua_de_id: null }];
    expect(idsQuePrometenParte2SinCumplir(piezas)).toEqual(new Set());
  });

  it("si la parte 2 se cancela/borra del calendario: la parte 1 vuelve a prometer sin cumplir", () => {
    // Antes (con la parte 2 presente) no prometía nada; al quitarla de
    // la lista (cancelada/borrada), vuelve a aparecer.
    const piezas = [{ id: "parte-1", receta_organica: "serie_partes" as const, continua_de_id: null }];
    expect(idsQuePrometenParte2SinCumplir(piezas)).toEqual(new Set(["parte-1"]));
  });
});

describe("elegirPistaMusicalOrganica (caso real: reel publicado en silencio total)", () => {
  it("sin pistas: null, nunca revienta", () => {
    expect(elegirPistaMusicalOrganica([])).toBe(null);
  });

  it("elige siempre una de las pistas CON LICENCIA (nunca inventa un id)", () => {
    const pistas = [
      { id: "a", mood: "calida", licencia_url: "https://licencia.real/a" },
      { id: "b", mood: "confiable", licencia_url: "https://licencia.real/b" },
    ];
    for (let i = 0; i < 20; i++) {
      expect(["a", "b"]).toContain(elegirPistaMusicalOrganica(pistas));
    }
  });

  it("nunca elige mood 'urgente' si hay otra opción con licencia (eso es para venta directa, no contenido de valor)", () => {
    const pistas = [
      { id: "a", mood: "urgente", licencia_url: "https://licencia.real/a" },
      { id: "b", mood: "calida", licencia_url: "https://licencia.real/b" },
    ];
    for (let i = 0; i < 20; i++) {
      expect(elegirPistaMusicalOrganica(pistas)).toBe("b");
    }
  });

  it("si TODAS son 'urgente' pero tienen licencia, usa una de esas antes que dejar la pieza en silencio", () => {
    const pistas = [{ id: "a", mood: "urgente", licencia_url: "https://licencia.real/a" }];
    expect(elegirPistaMusicalOrganica(pistas)).toBe("a");
  });

  it("pedido explícito: nunca elige una pista sin licencia, aunque sea la única disponible -- sin música es mejor que sin derechos", () => {
    const pistas = [{ id: "a", mood: "calida", licencia_url: null }];
    expect(elegirPistaMusicalOrganica(pistas)).toBe(null);
  });

  it("con varias pistas, solo considera las que sí tienen licencia", () => {
    const pistas = [
      { id: "sin-licencia", mood: "calida", licencia_url: null },
      { id: "con-licencia", mood: "calida", licencia_url: "https://licencia.real/x" },
    ];
    for (let i = 0; i < 20; i++) {
      expect(elegirPistaMusicalOrganica(pistas)).toBe("con-licencia");
    }
  });

  it("caso real (21 nov 2026): 0 de 21 pistas con licencia -- queda en null, no revienta", () => {
    const pistas = Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, mood: "calida", licencia_url: null }));
    expect(elegirPistaMusicalOrganica(pistas)).toBe(null);
  });
});
