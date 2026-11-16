import { describe, it, expect } from "vitest";
import { alinearPalabras } from "./alinearPalabras";

function palabra(texto: string, inicio_s: number, fin_s: number) {
  return { texto, inicio_s, fin_s };
}

describe("alinearPalabras", () => {
  it("conteo exacto: asigna por posición, puntaje 1, y los límites de cada escena caen en el primer/último timestamp real", () => {
    const escenas = [
      { id: "e1", narracion: "Hola a todos" },
      { id: "e2", narracion: "Sígueme para más" },
    ];
    const reales = [
      palabra("hola", 0, 0.3),
      palabra("a", 0.3, 0.4),
      palabra("todos", 0.4, 0.8),
      palabra("sígueme", 0.8, 1.2),
      palabra("para", 1.2, 1.4),
      palabra("más", 1.4, 1.7),
    ];
    const { tiemposRender, puntaje } = alinearPalabras(escenas, reales);
    expect(puntaje).toBe(1);
    expect(tiemposRender).toEqual([
      { escena_id: "e1", inicio_s: 0, fin_s: 0.8 },
      { escena_id: "e2", inicio_s: 0.8, fin_s: 1.7 },
    ]);
  });

  it("palabrasPorEscena trae el tiempo real de cada palabra individual, agrupado por escena", () => {
    const escenas = [{ id: "e1", narracion: "Hola a todos" }];
    const reales = [palabra("hola", 0, 0.3), palabra("a", 0.3, 0.4), palabra("todos", 0.4, 0.8)];
    const { palabrasPorEscena } = alinearPalabras(escenas, reales);
    expect(palabrasPorEscena).toEqual([{ escena_id: "e1", palabras: reales }]);
  });

  it("conteo distinto (Whisper fusionó 2 palabras en 1): alinea por similitud, puntaje menor a 1 pero mayor a 0, nunca lanza", () => {
    // "muy bien" se transcribió como una sola palabra "muybien" --
    // caso real documentado por la investigación externa (fusiones
    // puntuales de Whisper).
    const escenas = [{ id: "e1", narracion: "Esto está muy bien hoy" }];
    const reales = [
      palabra("esto", 0, 0.2),
      palabra("está", 0.2, 0.4),
      palabra("muybien", 0.4, 0.9),
      palabra("hoy", 0.9, 1.1),
    ];
    const { tiemposRender, puntaje } = alinearPalabras(escenas, reales);
    expect(puntaje).toBeGreaterThan(0);
    expect(puntaje).toBeLessThan(1);
    expect(tiemposRender).toHaveLength(1);
    expect(tiemposRender[0].inicio_s).toBe(0);
    expect(tiemposRender[0].fin_s).toBe(1.1);
  });

  it("sin palabras reales (audio vacío/transcripción fallida): puntaje 0, nunca lanza, tiemposRender sigue teniendo una fila por escena", () => {
    const escenas = [{ id: "e1", narracion: "Hola" }, { id: "e2", narracion: "Chau" }];
    const { tiemposRender, puntaje } = alinearPalabras(escenas, []);
    expect(puntaje).toBe(0);
    expect(tiemposRender.map((t) => t.escena_id)).toEqual(["e1", "e2"]);
  });

  it("mayúsculas y puntuación no afectan la coincidencia (normalización)", () => {
    const escenas = [{ id: "e1", narracion: "¿Sabías esto? Es grande." }];
    const reales = [palabra("sabías", 0, 0.3), palabra("esto", 0.3, 0.6), palabra("es", 0.6, 0.7), palabra("grande", 0.7, 1.0)];
    const { puntaje } = alinearPalabras(escenas, reales);
    expect(puntaje).toBe(1);
  });
});
