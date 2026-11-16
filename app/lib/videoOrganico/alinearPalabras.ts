import type { PalabraConTiempo } from "./generarVoz";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 3). Whisper no garantiza alinear EXACTO con el texto que se
// le dio a TTS (puede fusionar, separar o transcribir distinto una
// palabra) -- en el caso normal (conteo exacto) se asigna por
// posición; si no coincide, se alinea por similitud de secuencia
// (LCS) en vez de fallar o alinear a ciegas. El control de calidad
// (video/visuales/validarEdicionDesdeAudio.ts lo complementa; esto es
// otro paso) usa el "puntaje" para marcar "desfase" si es muy bajo.

export type EscenaConNarracion = { id: string; narracion: string };
export type TiempoRenderEscena = { escena_id: string; inicio_s: number; fin_s: number };
export type ResultadoAlineacion = { tiemposRender: TiempoRenderEscena[]; puntaje: number };

// Mismo criterio de normalización en los dos lados (lo esperado y lo
// que transcribió Whisper) -- minúsculas, sin puntuación pegada a la
// palabra, espacios colapsados. Los números en letras son
// responsabilidad del prompt (la IA nunca escribe dígitos en
// narracion); esta función no los convierte, solo normaliza forma.
function normalizarPalabra(palabra: string): string {
  return palabra
    .toLowerCase()
    .trim()
    .replace(/^[¿¡"'“”‘’(«]+/, "")
    .replace(/[.,!?¿¡"'“”‘’)»:;]+$/, "");
}

function partirEnPalabras(texto: string): string[] {
  return texto
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizarPalabra)
    .filter((p) => p.length > 0);
}

// LCS clásico (DP O(n*m), de sobra para una narración de un reel --
// decenas de palabras, nunca miles) -- devuelve los pares de índices
// (iEsperada, jReal) que coinciden, en orden, maximizando la cantidad
// de coincidencias (nunca solo la primera que encuentra).
function alinearPorSimilitud(esperadas: string[], reales: string[]): Map<number, number> {
  const n = esperadas.length;
  const m = reales.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = esperadas[i - 1] === reales[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const pares = new Map<number, number>();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (esperadas[i - 1] === reales[j - 1]) {
      pares.set(i - 1, j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return pares;
}

export function alinearPalabras(escenas: EscenaConNarracion[], palabrasReales: PalabraConTiempo[]): ResultadoAlineacion {
  const porEscena = escenas.map((e) => partirEnPalabras(e.narracion));
  const esperadas = porEscena.flat();
  const reales = palabrasReales.map((p) => normalizarPalabra(p.texto));

  if (esperadas.length === 0 || palabrasReales.length === 0) {
    return { tiemposRender: escenas.map((e) => ({ escena_id: e.id, inicio_s: 0, fin_s: 0 })), puntaje: 0 };
  }

  // Caso normal: el conteo coincide exacto -- asignación 1:1 por
  // posición, sin correr el LCS (más barato y, al coincidir el
  // conteo, igual de correcto).
  const coincideConteo = esperadas.length === palabrasReales.length;
  const pares: Map<number, number> = coincideConteo
    ? new Map(esperadas.map((_, i) => [i, i]))
    : alinearPorSimilitud(esperadas, reales);

  // Tiempo asignado a cada palabra esperada: directo si está en
  // "pares", interpolado linealmente entre los vecinos alineados más
  // cercanos si no (y en los bordes, el tiempo del vecino alineado más
  // cercano, sin extrapolar hacia afuera del audio real).
  const tiempos: PalabraConTiempo[] = esperadas.map((texto, i) => {
    const j = pares.get(i);
    if (j !== undefined) return palabrasReales[j];
    return { texto, inicio_s: NaN, fin_s: NaN };
  });

  for (let i = 0; i < tiempos.length; i++) {
    if (!Number.isNaN(tiempos[i].inicio_s)) continue;
    let antes = i - 1;
    while (antes >= 0 && Number.isNaN(tiempos[antes].inicio_s)) antes--;
    let despues = i + 1;
    while (despues < tiempos.length && Number.isNaN(tiempos[despues].inicio_s)) despues++;

    if (antes < 0 && despues >= tiempos.length) {
      tiempos[i] = { texto: tiempos[i].texto, inicio_s: 0, fin_s: 0 };
    } else if (antes < 0) {
      tiempos[i] = { texto: tiempos[i].texto, inicio_s: tiempos[despues].inicio_s, fin_s: tiempos[despues].inicio_s };
    } else if (despues >= tiempos.length) {
      tiempos[i] = { texto: tiempos[i].texto, inicio_s: tiempos[antes].fin_s, fin_s: tiempos[antes].fin_s };
    } else {
      const t = (i - antes) / (despues - antes);
      const inicio = tiempos[antes].fin_s + (tiempos[despues].inicio_s - tiempos[antes].fin_s) * t;
      tiempos[i] = { texto: tiempos[i].texto, inicio_s: inicio, fin_s: inicio };
    }
  }

  const tiemposRender: TiempoRenderEscena[] = [];
  let cursor = 0;
  for (let indiceEscena = 0; indiceEscena < escenas.length; indiceEscena++) {
    const cantidad = porEscena[indiceEscena].length;
    const delaEscena = tiempos.slice(cursor, cursor + cantidad);
    cursor += cantidad;
    if (delaEscena.length === 0) {
      tiemposRender.push({ escena_id: escenas[indiceEscena].id, inicio_s: 0, fin_s: 0 });
      continue;
    }
    tiemposRender.push({
      escena_id: escenas[indiceEscena].id,
      inicio_s: delaEscena[0].inicio_s,
      fin_s: delaEscena[delaEscena.length - 1].fin_s,
    });
  }

  const puntaje = pares.size / esperadas.length;
  return { tiemposRender, puntaje };
}
