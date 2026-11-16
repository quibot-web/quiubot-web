// Caso real que motivó esto (18 nov 2026): GuionSchema no puede exigir
// narracion/visual para TODO uso "organico" sin romper retroactivamente
// las 6 recetas ya en producción (ninguna los trae todavía) -- por eso
// esta validación vive aparte, y estas pruebas confirman las 2 cosas:
// que GuionSchema sigue aceptando guiones orgánicos sin estos campos
// (fixtures reales, probado en video/arreglosAutomaticosGuion.test.ts
// y app/api/contenido/[id]/route.test.ts), y que esta función nueva sí
// los exige cuando se usa a propósito.
import { describe, it, expect } from "vitest";
import { GuionSchema, type Guion } from "../guion.schema";
import { validarEdicionDesdeAudio } from "./validarEdicionDesdeAudio";

function escenaBase(id: string, overrides: Partial<Guion["escenas"][number]> = {}): Guion["escenas"][number] {
  return {
    id,
    bloque: "valor",
    tipo: "cta",
    duracion_s: 3,
    params: { accion: "seguir", texto_boton: "Seguir" },
    ...overrides,
  } as Guion["escenas"][number];
}

describe("validarEdicionDesdeAudio", () => {
  it("sin narracion, reporta el hallazgo con el id de la escena", () => {
    const hallazgos = validarEdicionDesdeAudio([escenaBase("e1")]);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]).toMatchObject({ escenaId: "e1" });
    expect(hallazgos[0].mensaje).toContain("Falta narracion");
  });

  it("con narracion pero sin visual, reporta el hallazgo correcto", () => {
    const hallazgos = validarEdicionDesdeAudio([escenaBase("e1", { narracion: "Hola a todos hoy" })]);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].mensaje).toContain("Falta visual");
  });

  it("evento.palabra dentro del rango real de la narracion: sin hallazgos", () => {
    const escena = escenaBase("e1", {
      narracion: "Hola a todos hoy", // 4 palabras, índices 0-3
      visual: { tipo: "contador", desde: 0, hasta: 3, eventos: [{ palabra: 0, accion: "sube" }, { palabra: 3, accion: "sube" }] },
    });
    expect(validarEdicionDesdeAudio([escena])).toHaveLength(0);
  });

  it("evento.palabra fuera de rango (índice 5 en una narracion de 4 palabras): hallazgo con el mensaje exacto", () => {
    const escena = escenaBase("e1", {
      narracion: "Hola a todos hoy",
      visual: { tipo: "contador", desde: 0, hasta: 3, eventos: [{ palabra: 5, accion: "sube" }] },
    });
    const hallazgos = validarEdicionDesdeAudio([escena]);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].mensaje).toContain("palabra 5");
    expect(hallazgos[0].mensaje).toContain("4 palabra(s)");
  });

  it("GuionSchema sigue aceptando un guion orgánico real SIN narracion/visual (compatibilidad con las 6 recetas existentes)", () => {
    const guion = GuionSchema.parse({
      version: 1,
      formato: "9x16",
      fps: 30,
      uso: "organico",
      receta_organica: "consejos_numerados",
      gancho_tipo: "pregunta",
      duracion_objetivo_s: 16,
      bucle: { texto: "3 consejos", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
      tema: { color_primario: "#534AB7", color_secundario: "#7F77DD", fuente: "moderna", logo_url: null, nombre_marca: "Quiubot" },
      musica: { pista_id: null, volumen: 0.35 },
      publicacion: { caption: "Caption de prueba", hashtags: ["#tip", "#consejos", "#negocio"] },
      escenas: [
        { id: "e1", bloque: "gancho", tipo: "gancho_texto", duracion_s: 2.2, params: { texto: "¿Sabías esto?", palabra_clave: "esto" } },
        { id: "e2", bloque: "valor", tipo: "lista_numerada", duracion_s: 5, params: { titulo: "3 tips", items: ["uno", "dos", "tres"] } },
        { id: "e3", bloque: "marca", tipo: "revelacion_marca", duracion_s: 4, params: { frase: "Quiubot", mostrar_logo: true } },
        { id: "e4", bloque: "cta", tipo: "cta", duracion_s: 4, params: { accion: "seguir", texto_boton: "Seguir" } },
      ],
    });
    // Y por lo tanto esta misma lista de escenas SÍ dispara hallazgos
    // si se le pide validarEdicionDesdeAudio() a propósito.
    expect(validarEdicionDesdeAudio(guion.escenas).length).toBeGreaterThan(0);
  });
});
