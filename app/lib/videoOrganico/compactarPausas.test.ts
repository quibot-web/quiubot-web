import { describe, it, expect } from "vitest";
import { compactarConSilenciosReales, corregirPalabrasConSilencios, MARGEN_ANTES_DE_PALABRA_S, PAUSA_DENTRO_DE_FRASE_S, PAUSA_ENTRE_FRASES_S } from "./compactarPausas";

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

  it("silencio real ANTES de la primera palabra se recorta hasta 120 ms antes de que la voz arranque (el gancho arranca en ~0.12 s, sin morder el ataque)", () => {
    const palabras = [
      { texto: "¿Cero", inicio_s: 0.42, fin_s: 0.9 },
      { texto: "mensajes?", inicio_s: 0.9, fin_s: 1.3 },
    ];
    const silencios = [{ inicio_s: 0, fin_s: 0.42 }];
    const { palabras: resultado, tramosPorEscena } = compactarConSilenciosReales(palabras, silencios, [0, 0]);
    expect(resultado[0].compactado.inicio_s).toBeCloseTo(MARGEN_ANTES_DE_PALABRA_S, 5);
    expect(tramosPorEscena[0][0].original.inicio_s).toBeCloseTo(0.42 - MARGEN_ANTES_DE_PALABRA_S, 5);
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
    // Se comprime (ya NO se deja intacto), pero solo DENTRO del silencio
    // medido: quedan 0.4 s de ese silencio (23 nov 2026: nunca se corta
    // con los bordes de Whisper).
    const quitado = 8.063 - 7.484 - PAUSA_ENTRE_FRASES_S;
    expect(resultado[1].compactado.inicio_s).toBeCloseTo(8.5 - quitado, 5);
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

  it("caso real (prototipo ilustrado, 18 nov 2026): Whisper deja una palabra con duración cero justo al borde del silencio -- el silencio se empareja con el hueco con el que más se superpone, no con el de la palabra anterior", () => {
    // Whisper: "a" 33.07-33.10, "volver." 33.10-33.10 (duración cero), "Sigue" 34.10.
    // ffmpeg: silencio real 33.05-33.86 (0.81s) -- de verdad está entre "volver" y "Sigue".
    const palabras = [
      { texto: "a", inicio_s: 33.07, fin_s: 33.1 },
      { texto: "volver.", inicio_s: 33.1, fin_s: 33.1 },
      { texto: "Sigue", inicio_s: 34.1, fin_s: 34.18 },
      { texto: "a", inicio_s: 34.18, fin_s: 34.3 },
    ];
    const silencios = [{ inicio_s: 33.0497, fin_s: 33.8614 }];
    const { palabras: resultado, tramosPorEscena } = compactarConSilenciosReales(palabras, silencios, [0, 0, 1, 1]);
    // Del silencio medido (0.81 s) quedan 0.4 s; Whisper marca "Sigue"
    // 0.24 s después de donde termina el silencio y "volver." 0.05 s
    // después de donde empieza, así que entre sus tiempos hay 0.4 + 0.24 - 0.05.
    const hueco = resultado[2].compactado.inicio_s - resultado[1].compactado.fin_s;
    expect(hueco).toBeCloseTo(PAUSA_ENTRE_FRASES_S + (34.1 - 33.8614) - (33.1 - 33.0497), 5);
    expect(tramosPorEscena[1][0].original.inicio_s).toBeCloseTo(33.8614 - PAUSA_ENTRE_FRASES_S / 2, 5);
  });

  it("caso real (prototipo, 18 nov 2026): los dos bordes de Whisper se meten ~90ms en un silencio real de 0.76s -- ya no se deja sin tocar si la zona segura (hueco y silencio a la vez) es grande", () => {
    const palabras = [
      { texto: "se", inicio_s: 28.32, fin_s: 28.76 },
      { texto: "venta.", inicio_s: 28.94, fin_s: 29.3 },
      { texto: "Así", inicio_s: 29.88, fin_s: 30.18 },
      { texto: "tu", inicio_s: 30.18, fin_s: 30.38 },
    ];
    const silencios = [{ inicio_s: 29.21, fin_s: 29.97 }];
    const { palabras: r } = compactarConSilenciosReales(palabras, silencios, [0, 0, 1, 1]);
    // Se recorta (ya no queda intacto): del silencio medido quedan 0.4 s.
    const quitado = 29.97 - 29.21 - PAUSA_ENTRE_FRASES_S;
    expect(r[2].compactado.inicio_s).toBeCloseTo(29.88 - quitado, 5);
  });

  it("caso real (cd34eec3, 23 nov 2026): Whisper marca 'Escribe' 385 ms tarde -- el corte ya no se come el 'Es-'", () => {
    // Voz real: silencio medido a -50 dB 8.874-9.595; la voz de "Escribe"
    // arranca en 9.595, pero Whisper dice 9.98. Antes el tramo de e3
    // empezaba en 9.78 (se perdían ~180 ms: sonaba "cribe").
    const palabras = [
      { texto: "reacciones.", inicio_s: 8.3, fin_s: 8.84 },
      { texto: "Escribe", inicio_s: 9.98, fin_s: 10.4 },
    ];
    const silencios = [{ inicio_s: 8.874, fin_s: 9.5947 }];
    const { tramosPorEscena } = compactarConSilenciosReales(palabras, silencios, [0, 1]);
    expect(tramosPorEscena[1][0].original.inicio_s).toBeLessThanOrEqual(9.5947 - MARGEN_ANTES_DE_PALABRA_S + 1e-9);
    expect(tramosPorEscena[1][0].original.inicio_s).toBeGreaterThanOrEqual(8.874);
  });

  it("caso real (prototipo del kit, 23 nov 2026): Whisper amontona TODAS las palabras de la última frase en un mismo instante -- la escena igual recibe su audio (antes quedaba con duración 0)", () => {
    const palabras = [
      { texto: "en", inicio_s: 17.44, fin_s: 17.74 },
      { texto: "uso.", inicio_s: 17.74, fin_s: 17.8 },
      ...["Síguenos", "para", "más", "ideas", "como", "esta."].map((texto) => ({ texto, inicio_s: 17.8, fin_s: 17.8 })),
    ];
    const silencios = [
      { inicio_s: 17.93575, fin_s: 18.470083 },
      { inicio_s: 19.806375, fin_s: 20.352 },
    ];
    const { tramosPorEscena } = compactarConSilenciosReales(palabras, silencios, [0, 0, 1, 1, 1, 1, 1, 1]);
    expect(tramosPorEscena[1].length).toBeGreaterThan(0);
    // La escena nueva empieza dentro de la pausa real entre "uso." y "Síguenos".
    expect(tramosPorEscena[1][0].original.inicio_s).toBeGreaterThanOrEqual(17.93575);
    expect(tramosPorEscena[1][0].original.inicio_s).toBeLessThanOrEqual(18.470083);
  });

  it("regla de seguridad: con cualquier pausa y cualquier atraso de Whisper, ningún corte deja menos de 120 ms de silencio medido antes de una palabra, y todo lo quitado es silencio medido", () => {
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    for (let caso = 0; caso < 300; caso++) {
      const palabras: { texto: string; inicio_s: number; fin_s: number }[] = [];
      const silencios: { inicio_s: number; fin_s: number }[] = [];
      const escenas: number[] = [];
      let t = azar() * 0.6;
      if (t > 0.2) silencios.push({ inicio_s: 0, fin_s: t });
      for (let k = 0; k < 8; k++) {
        const dur = 0.15 + azar() * 0.5;
        const atrasoWhisper = azar() * 0.45; // Whisper marca tarde el inicio
        palabras.push({ texto: azar() < 0.3 ? "fin." : "pal", inicio_s: t + atrasoWhisper, fin_s: t + dur + atrasoWhisper * 0.2 });
        escenas.push(Math.floor(k / 3));
        t += dur;
        const pausa = azar() < 0.5 ? 0.05 + azar() * 0.15 : 0.2 + azar() * 1.2;
        if (pausa >= 0.2) silencios.push({ inicio_s: t, fin_s: t + pausa });
        t += pausa;
      }
      const opciones = azar() < 0.5 ? {} : { pausaEntreFrases_s: 0.3, pausaDentroDeFrase_s: 0.15 };
      const { tramosPorEscena } = compactarConSilenciosReales(palabras, silencios, escenas, opciones);
      const tramos = tramosPorEscena.flat().sort((a, b) => a.original.inicio_s - b.original.inicio_s);
      for (let k = 1; k < tramos.length; k++) {
        const quitadoDesde = tramos[k - 1].original.fin_s;
        const quitadoHasta = tramos[k].original.inicio_s;
        if (quitadoHasta - quitadoDesde < 1e-6) continue; // división sin recorte
        const s = silencios.find((x) => x.inicio_s - 1e-9 <= quitadoDesde && quitadoHasta <= x.fin_s + 1e-9);
        expect(s, `caso ${caso}: lo quitado ${quitadoDesde}-${quitadoHasta} no es silencio medido`).toBeDefined();
        expect(s!.fin_s - quitadoHasta).toBeGreaterThanOrEqual(MARGEN_ANTES_DE_PALABRA_S - 1e-9);
      }
    }
  });
});

describe("corregirPalabrasConSilencios (Whisper estira una palabra sobre un silencio real)", () => {
  it("caso real: 'y' 1.04-1.84 con silencio real 0.97-1.63 -> la palabra empieza al terminar el silencio", () => {
    const palabras = [
      { texto: "anuncios…", inicio_s: 0.4, fin_s: 1.04 },
      { texto: "y", inicio_s: 1.04, fin_s: 1.84 },
      { texto: "nadie", inicio_s: 1.84, fin_s: 2.08 },
    ];
    const corregidas = corregirPalabrasConSilencios(palabras, [{ inicio_s: 0.97, fin_s: 1.63 }]);
    expect(corregidas[1]).toEqual({ texto: "y", inicio_s: 1.63, fin_s: 1.84 });
    expect(corregidas[0]).toEqual(palabras[0]);
  });

  it("silencio al final de la palabra -> la palabra termina donde empieza el silencio; silencios cortos o que tapan la palabra entera no la tocan", () => {
    const p = [{ texto: "hola", inicio_s: 1, fin_s: 2 }];
    expect(corregirPalabrasConSilencios(p, [{ inicio_s: 1.3, fin_s: 2.4 }])[0]).toEqual({ texto: "hola", inicio_s: 1, fin_s: 1.3 });
    expect(corregirPalabrasConSilencios(p, [{ inicio_s: 1.8, fin_s: 2.0 }])[0]).toEqual(p[0]);
    expect(corregirPalabrasConSilencios(p, [{ inicio_s: 0.9, fin_s: 2.1 }])[0]).toEqual(p[0]);
  });
});

