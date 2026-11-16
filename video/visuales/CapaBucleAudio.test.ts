// Bug real encontrado generando un reel real de punta a punta (16 nov
// 2026, 3ra revisión de staging): "1/3, 2/3, 3/3" no aparecía en las
// escenas de consejo -- capas/Bucle.tsx calculaba sus límites con
// duracion_s (la estimación de la IA), no con tiemposRender (la línea
// de tiempo REAL del audio, la única que ReelAutomatico.tsx usa para
// posicionar las escenas).
import { describe, it, expect } from "vitest";
import { calcularLimitesEscenas, contenidoBucleAudio } from "./CapaBucleAudio";
import type { Guion } from "../guion.schema";

const GUION_BASE: Pick<Guion, "escenas" | "tiemposRender" | "fps"> = {
  fps: 30,
  escenas: [
    { id: "e1", bloque: "gancho" } as Guion["escenas"][number],
    { id: "e2", bloque: "valor" } as Guion["escenas"][number],
    { id: "e3", bloque: "valor" } as Guion["escenas"][number],
    { id: "e4", bloque: "valor" } as Guion["escenas"][number],
    { id: "e5", bloque: "marca" } as Guion["escenas"][number],
    { id: "e6", bloque: "cta" } as Guion["escenas"][number],
  ],
  tiemposRender: [
    { escena_id: "e1", inicio_s: 0, fin_s: 3 }, // 90 cuadros
    { escena_id: "e2", inicio_s: 3.5, fin_s: 7 }, // 105 cuadros (3.5s de habla)
    { escena_id: "e3", inicio_s: 7.4, fin_s: 11 }, // 108 cuadros
    { escena_id: "e4", inicio_s: 11.4, fin_s: 14 }, // 78 cuadros
    { escena_id: "e5", inicio_s: 14.4, fin_s: 17 },
    { escena_id: "e6", inicio_s: 17.4, fin_s: 19 },
  ],
};

describe("calcularLimitesEscenas", () => {
  it("apila cada escena por su PROPIA duración de habla (fin_s-inicio_s), sin los huecos reales entre escenas", () => {
    const limites = calcularLimitesEscenas(GUION_BASE);
    expect(limites[0]).toEqual({ id: "e1", bloque: "gancho", inicioCuadro: 0, finCuadro: 90 });
    // e2 arranca donde terminó e1 (90), no en 3.5*30=105 (el segundo
    // ABSOLUTO del audio) -- ese fue justo el bug real.
    expect(limites[1]).toEqual({ id: "e2", bloque: "valor", inicioCuadro: 90, finCuadro: 195 });
    expect(limites[2]).toEqual({ id: "e3", bloque: "valor", inicioCuadro: 195, finCuadro: 303 });
  });
});

describe("contenidoBucleAudio", () => {
  const limites = calcularLimitesEscenas(GUION_BASE);
  const bucleContador: Guion["bucle"] = { texto: "3 ajustes", abre_en: "e1", cierra_en: "e4", indicador: "contador" };

  it("durante el gancho, muestra la promesa (👀 + texto)", () => {
    expect(contenidoBucleAudio(10, bucleContador, limites)).toBe("👀 3 ajustes");
  });

  it("durante cada escena de consejo (valor), muestra k/3 -- no la promesa ni un hueco", () => {
    expect(contenidoBucleAudio(100, bucleContador, limites)).toBe("1/3"); // dentro de e2 (90-195)
    expect(contenidoBucleAudio(200, bucleContador, limites)).toBe("2/3"); // dentro de e3 (195-303)
    expect(contenidoBucleAudio(310, bucleContador, limites)).toBe("3/3"); // dentro de e4
  });

  it("desde 'marca' en adelante, se oculta (ya se cumplió la promesa)", () => {
    const limiteE5 = limites.find((l) => l.id === "e5")!;
    expect(contenidoBucleAudio(limiteE5.inicioCuadro + 1, bucleContador, limites)).toBeNull();
  });

  it("indicador 'ninguno': nunca muestra nada, ni en el gancho ni en los consejos", () => {
    const bucleNinguno: Guion["bucle"] = { ...bucleContador, indicador: "ninguno" };
    expect(contenidoBucleAudio(10, bucleNinguno, limites)).toBeNull();
    expect(contenidoBucleAudio(100, bucleNinguno, limites)).toBeNull();
  });

  it("indicador 'espera_final': repite la promesa en vez de un contador, también durante los consejos", () => {
    const bucleEspera: Guion["bucle"] = { ...bucleContador, indicador: "espera_final" };
    expect(contenidoBucleAudio(10, bucleEspera, limites)).toBe("👀 espera al final");
    expect(contenidoBucleAudio(100, bucleEspera, limites)).toBe("👀 3 ajustes");
  });
});
