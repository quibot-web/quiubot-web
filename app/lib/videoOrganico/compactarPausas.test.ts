import { describe, it, expect } from "vitest";
import { compactarConSilenciosReales, PAUSA_DENTRO_DE_FRASE_S, PAUSA_ENTRE_FRASES_S } from "./compactarPausas";

describe("compactarConSilenciosReales", () => {
  it("sin silencios reales detectados, nada se toca y da un solo tramo por escena", () => {
    const palabras = [
      { texto: "Hola", inicio_s: 0, fin_s: 0.3 },
      { texto: "mundo", inicio_s: 0.3, fin_s: 0.6 },
      { texto: "bien", inicio_s: 0.6, fin_s: 1.0 },
    ];
    const { palabras: resultado, tramosPorEscena } = compactarConSilenciosReales(palabras, [], [0, 0, 1]);
    for (const p of resultado) expect(p.compactado).toEqual(p.original);
    expect(tramosPorEscena[0]).toHaveLength(1);
    expect(tramosPorEscena[1]).toHaveLength(1);
  });

  it("silencio real ANTES de la primera palabra se recorta por completo (el gancho arranca en ~0)", () => {
    const palabras = [
      { texto: "¿Cero", inicio_s: 0.42, fin_s: 0.9 },
      { texto: "mensajes?", inicio_s: 0.9, fin_s: 1.3 },
    ];
    const silencios = [{ inicio_s: 0, fin_s: 0.42 }];
    const { palabras: resultado } = compactarConSilenciosReales(palabras, silencios, [0, 0]);
    expect(resultado[0].compactado.inicio_s).toBeCloseTo(0, 5);
  });

  it("silencio real DENTRO de una frase (sin puntuación fuerte antes) se recorta a 0.25s, nunca a 0.4", () => {
    // Caso real medido (ronda H): "mensajes" (fin 1.06) -> "aunque" (inicio 1.62), 0.56s real.
    const palabras = [
      { texto: "¿Cero", inicio_s: 0, fin_s: 0.52 },
      { texto: "mensajes", inicio_s: 0.52, fin_s: 1.06 },
      { texto: "aunque", inicio_s: 1.62, fin_s: 1.7 },
    ];
    const silencios = [{ inicio_s: 1.06, fin_s: 1.62 }];
    const { palabras: resultado } = compactarConSilenciosReales(palabras, silencios, [0, 0, 0]);
    expect(resultado[2].compactado.inicio_s).toBeCloseTo(1.06 + PAUSA_DENTRO_DE_FRASE_S, 5);
  });

  it("silencio real tras una palabra que termina en puntuación fuerte (.?!;) se trata como límite de frase (0.4s), aunque sea la MISMA escena", () => {
    // Caso real que mordió "Quiubot": "mensajes;" (fin 19.92) -> "Quiubot" (inicio 20.82), 0.9s, misma escena e5.
    const palabras = [
      { texto: "mensajes;", inicio_s: 19.42, fin_s: 19.92 },
      { texto: "Quiubot", inicio_s: 20.82, fin_s: 20.98 },
    ];
    const silencios = [{ inicio_s: 19.92, fin_s: 20.82 }];
    const { palabras: resultado } = compactarConSilenciosReales(palabras, silencios, [0, 0]);
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(19.92 + PAUSA_ENTRE_FRASES_S, 5);
    // la palabra sobrevive completa: su propia duración nunca cambia
    expect(resultado[1].compactado.fin_s - resultado[1].compactado.inicio_s).toBeCloseTo(0.16, 5);
  });

  it("silencio real entre dos escenas distintas se recorta a 0.4s (nunca a 0.25, y con margen real a los dos lados -- nunca justo en el límite medido de la palabra)", () => {
    // Caso real que mordió "conecta": última palabra de e2 -> "conecta" (primera de e3).
    const palabras = [
      { texto: "visible.", inicio_s: 7.5, fin_s: 8.1 }, // última de e2
      { texto: "Segundo,", inicio_s: 9.0, fin_s: 9.4 },
      { texto: "conecta", inicio_s: 9.9, fin_s: 10.1 }, // 2da de e3, tras un hueco chico dentro de la misma escena
    ];
    const silencios = [{ inicio_s: 8.1, fin_s: 9.0 }]; // hueco ENTRE e2 y e3, 0.9s real
    const { palabras: resultado, tramosPorEscena } = compactarConSilenciosReales(palabras, silencios, [0, 1, 1]);
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(8.1 + PAUSA_ENTRE_FRASES_S, 5);
    // el recorte cae DENTRO del silencio real (nunca toca ni la última palabra de e2 ni "Segundo,") --
    // el corte real queda repartido simétrico: mitad guardada a cada lado.
    expect(tramosPorEscena[0]).toHaveLength(1); // e2: 1 solo tramo, su propio audio intacto
    expect(tramosPorEscena[1]).toHaveLength(1); // e3: "Segundo, conecta" sin huecos grandes adentro, 1 tramo
    expect(tramosPorEscena[0][0].original.fin_s).toBeCloseTo(8.1 + PAUSA_ENTRE_FRASES_S / 2, 5); // mitad del objetivo guardada tras la última palabra de e2
    expect(tramosPorEscena[1][0].original.inicio_s).toBeCloseTo(9.0 - PAUSA_ENTRE_FRASES_S / 2, 5); // mitad del objetivo guardada antes de "Segundo,"
  });

  it("un hueco entre escenas YA dentro del objetivo (<=0.4s) no se recorta, pero igual separa en tramos por escena", () => {
    const palabras = [
      { texto: "a", inicio_s: 0, fin_s: 0.3 },
      { texto: "b", inicio_s: 0.6, fin_s: 0.9 }, // hueco real de 0.3s, ya <= 0.4
    ];
    const silencios = [{ inicio_s: 0.3, fin_s: 0.6 }];
    const { palabras: resultado, tramosPorEscena } = compactarConSilenciosReales(palabras, silencios, [0, 1]);
    expect(resultado[1].compactado).toEqual(resultado[1].original);
    expect(tramosPorEscena[0]).toHaveLength(1);
    expect(tramosPorEscena[1]).toHaveLength(1);
    expect(tramosPorEscena[0][0].original.fin_s).toBeCloseTo(0.45, 5); // split sin edición, en el punto medio del hueco real
    expect(tramosPorEscena[1][0].original.inicio_s).toBeCloseTo(0.45, 5);
  });

  it("un silencio real que no calza con NINGÚN hueco de palabras (ambiguo) nunca se toca", () => {
    const palabras = [
      { texto: "a", inicio_s: 0, fin_s: 0.3 },
      { texto: "b", inicio_s: 0.3, fin_s: 0.6 },
    ];
    // Este "silencio" se solapa con el final de "a" y el principio de "b" -- no calza limpio en ningún hueco real.
    const silencios = [{ inicio_s: 0.1, fin_s: 0.5 }];
    const { palabras: resultado } = compactarConSilenciosReales(palabras, silencios, [0, 0]);
    for (const p of resultado) expect(p.compactado).toEqual(p.original);
  });

  it("varias remociones consecutivas acumulan corrimiento sin pisarse", () => {
    const palabras = [
      { texto: "a.", inicio_s: 0, fin_s: 0.2 }, // termina en "." -> el hueco DESPUÉS de esta es límite de frase
      { texto: "b.", inicio_s: 1.2, fin_s: 1.4 }, // también termina en "." -> el siguiente hueco también
      { texto: "c", inicio_s: 2.4, fin_s: 2.6 },
    ];
    const silencios = [
      { inicio_s: 0.2, fin_s: 1.2 },
      { inicio_s: 1.4, fin_s: 2.4 },
    ];
    const { palabras: resultado } = compactarConSilenciosReales(palabras, silencios, [0, 0, 0]);
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(0.2 + PAUSA_ENTRE_FRASES_S, 5);
    expect(resultado[2].compactado.inicio_s).toBeCloseTo(0.2 + PAUSA_ENTRE_FRASES_S + 0.2 + PAUSA_ENTRE_FRASES_S, 5);
  });

  it("lista de palabras vacía da listas vacías", () => {
    expect(compactarConSilenciosReales([], [], [])).toEqual({ palabras: [], tramosPorEscena: [] });
  });

  it("ronda J -- caso real: la palabra ANTERIOR se mete en el silencio (Whisper la reporta más larga de lo real), pero la SIGUIENTE no -- ya no se deja sin tocar", () => {
    // Caso real medido (cedar.mp3, ronda J): "anuncio" reporta fin_s=7.98
    // pero ffmpeg ya mide silencio real desde 7.484 -- el hueco entre
    // escenas (e2->e3) quedaba sin comprimir por completo (0.73s) porque
    // el viejo emparejamiento exigía que AMBAS palabras vecinas calzaran
    // dentro de una tolerancia de 50ms.
    const palabras = [
      { texto: "anuncio", inicio_s: 7.12, fin_s: 7.98 }, // última de e2, Whisper la reporta más larga de lo real
      { texto: "Segundo", inicio_s: 8.5, fin_s: 8.5 }, // primera de e3 (valores reales medidos)
    ];
    const silencios = [{ inicio_s: 7.484, fin_s: 8.063 }]; // silencio real medido por ffmpeg
    const { palabras: resultado } = compactarConSilenciosReales(palabras, silencios, [0, 1]);
    // se comprime a 0.4s (límite de frase, distinta escena) -- medido
    // sobre el hueco ENTERO entre palabras (7.98 a 8.5), no solo sobre
    // el sub-tramo que ffmpeg marcó -- ya NO se deja intacto.
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(7.98 + PAUSA_ENTRE_FRASES_S, 5);
  });

  it("ronda J -- techo duro de 0.5s: nunca se supera aunque pausaEntreFrases_s pida más", () => {
    const palabras = [
      { texto: "a.", inicio_s: 0, fin_s: 0.2 },
      { texto: "b", inicio_s: 2, fin_s: 2.2 },
    ];
    const silencios = [{ inicio_s: 0.2, fin_s: 2 }];
    const { palabras: resultado } = compactarConSilenciosReales(palabras, silencios, [0, 0], { pausaEntreFrases_s: 0.8 });
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(0.2 + 0.5, 5);
  });
});
