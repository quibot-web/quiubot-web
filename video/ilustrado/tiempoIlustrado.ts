// Prototipo "reel ilustrado" (18 nov 2026, nueva dirección visual): un
// solo mundo 2.5D por reel, la cámara se mueve por él y cada cambio está
// amarrado a una palabra de la narración. Este archivo es puro (sin
// React): línea de tiempo global y cámara continua.
//
// Los tiempos vienen del mismo pipeline de voz del flujo real (alinear
// palabras + compactar pausas): cada escena dura (fin - inicio) de
// tiemposRender, una después de la otra, y cada palabra cae en
// (inicio de su escena) + (su inicio - inicio de la escena).
export type PalabraTiempo = { texto: string; inicio_s: number; fin_s: number };
export type TiemposIlustrado = {
  tiemposRender: { escena_id: string; inicio_s: number; fin_s: number }[];
  palabrasPorEscena: { escena_id: string; palabras: PalabraTiempo[] }[];
  segmentosAudio: { escena_id: string; tramos: { original: { inicio_s: number; fin_s: number }; compactado: { inicio_s: number; fin_s: number } }[] }[];
};

export type LineaDeTiempo = {
  fps: number;
  duracionCuadros: number;
  escenas: { id: string; desde: number; duracion: number; inicio_s: number }[];
  // Cuadro global del inicio de la palabra i de la escena "id".
  cuadroDePalabra: (id: string, indice: number) => number;
  // Todas las palabras con su cuadro global (subtítulos).
  palabras: { escena: string; texto: string; desde: number; hasta: number }[];
};

export function construirLineaDeTiempo(t: TiemposIlustrado, fps: number): LineaDeTiempo {
  let acumulado = 0;
  const escenas = t.tiemposRender.map((tr) => {
    const duracion = Math.round((tr.fin_s - tr.inicio_s) * fps);
    const e = { id: tr.escena_id, desde: acumulado, duracion, inicio_s: tr.inicio_s };
    acumulado += duracion;
    return e;
  });
  const palabras = t.palabrasPorEscena.flatMap((pe) => {
    const e = escenas.find((x) => x.id === pe.escena_id)!;
    return pe.palabras.map((p) => ({
      escena: pe.escena_id,
      texto: p.texto,
      desde: e.desde + Math.round((p.inicio_s - e.inicio_s) * fps),
      hasta: e.desde + Math.round((p.fin_s - e.inicio_s) * fps),
    }));
  });
  const cuadroDePalabra = (id: string, indice: number) => {
    const delaEscena = palabras.filter((p) => p.escena === id);
    const p = delaEscena[Math.min(indice, delaEscena.length - 1)];
    if (!p) throw new Error(`Palabra ${indice} de ${id} no existe`);
    return p.desde;
  };
  return { fps, duracionCuadros: acumulado, escenas, cuadroDePalabra, palabras };
}

// Cámara: puntos clave (cuadro -> centro del mundo y zoom) y movimiento
// suave entre ellos (ease in-out). Nunca corta: siempre interpola.
export type PuntoCamara = { cuadro: number; x: number; y: number; zoom: number };

// Seno in-out: la velocidad máxima es ~1,57 veces la promedio (con la
// cúbica era 3 veces) -- arranca y frena suave sin un tirón en el medio.
function suave(t: number): number {
  return 0.5 - Math.cos(Math.PI * t) / 2;
}

export function camaraEnCuadro(puntos: PuntoCamara[], frame: number): { x: number; y: number; zoom: number } {
  const orden = [...puntos].sort((a, b) => a.cuadro - b.cuadro);
  if (frame <= orden[0].cuadro) return orden[0];
  const ultimo = orden[orden.length - 1];
  if (frame >= ultimo.cuadro) return ultimo;
  const i = orden.findIndex((p) => p.cuadro > frame);
  const a = orden[i - 1];
  const b = orden[i];
  const t = suave((frame - a.cuadro) / Math.max(1, b.cuadro - a.cuadro));
  // El zoom se interpola en escala logarítmica (acercarse se siente parejo).
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * t);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, zoom };
}

// Silencio más largo entre palabras seguidas (en la línea de tiempo ya
// compactada) -- para el reporte y el test (máximo 0,6 s).
export function silencioMasLargo(linea: LineaDeTiempo): number {
  let maximo = 0;
  for (let i = 1; i < linea.palabras.length; i++) maximo = Math.max(maximo, linea.palabras[i].desde - linea.palabras[i - 1].hasta);
  return maximo / linea.fps;
}
