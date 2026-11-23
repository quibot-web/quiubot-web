// Control obligatorio después del render (23 nov 2026): ¿llegó entero al
// video final el arranque de cada palabra?
//
// Es la misma medición del diagnóstico que encontró la voz mordida: se
// compara la ENERGÍA del audio final contra la voz TTS original, nunca una
// transcripción (Whisper fue justo lo que falló, y transcribe "cribe" como
// "Escribe"). Para cada arranque de palabra de la voz original (voz que
// sube después de al menos 60 ms de silencio):
//   1. Lo quitado por la compactación nunca puede tocarlo: debe quedar
//      dentro de un tramo, con >= 120 ms de silencio conservado antes
//      (si antes hubo un corte).
//   2. En el video, ese arranque llega con su energía (no pierde más de
//      3 dB respecto del resto de la voz) y en su lugar (no se corre más
//      de 40 ms).
// Función pura: el navegador decodifica los dos audios y llama acá.

export type AudioMono = { muestras: Float32Array; sampleRate: number };
export type TramoVoz = { original: { inicio_s: number; fin_s: number }; compactado: { inicio_s: number; fin_s: number } };

export type ArranqueMedido = {
  original_s: number;
  final_s: number | null;
  palabra: string | null;
  margen_ms: number | null;
  perdida_db: number | null;
  desfase_ms: number | null;
};

export type ResultadoArranques = { hallazgos: string[]; arranques: ArranqueMedido[]; desfaseGlobal_ms: number };

export const PASO_S = 0.005;
const UMBRAL_VOZ_DB = -50; // mismo umbral que detectarSilenciosReales
const SILENCIO_PREVIO_S = 0.06;
const ATAQUE_FUERTE_BAJO_PICO_DB = 35;
const VENTANA_ANTES_S = 0.02;
const VENTANA_DESPUES_S = 0.15;
export const MARGEN_MINIMO_S = 0.12;
export const PERDIDA_MAXIMA_DB = 3;
export const DESFASE_MAXIMO_MS = 40;
const BUSQUEDA_LOCAL_S = 0.15;

export function envolventeDb(audio: AudioMono, paso_s = PASO_S): Float32Array {
  const n = Math.max(1, Math.round(paso_s * audio.sampleRate));
  const k = Math.floor(audio.muestras.length / n);
  const salida = new Float32Array(k);
  for (let i = 0; i < k; i++) {
    let suma = 0;
    for (let j = i * n; j < (i + 1) * n; j++) suma += audio.muestras[j] * audio.muestras[j];
    salida[i] = 10 * Math.log10(suma / n + 1e-18);
  }
  return salida;
}

// Arranques de palabra en la voz original: la voz sube fuerte después de
// >= 60 ms bajo el umbral; el arranque real es donde cruza el umbral.
export function arranquesDeVoz(env: Float32Array, paso_s = PASO_S): number[] {
  let pico = -Infinity;
  for (const v of env) if (v > pico) pico = v;
  const fuerte = pico - ATAQUE_FUERTE_BAJO_PICO_DB;
  const previo = Math.round(SILENCIO_PREVIO_S / paso_s);
  const arranques: number[] = [];
  let i = 0;
  while (i < env.length) {
    if (env[i] < fuerte) {
      i++;
      continue;
    }
    // retrocede hasta donde la voz cruza el umbral
    let j = i;
    while (j > 0 && env[j - 1] > UMBRAL_VOZ_DB) j--;
    let silencioAntes = true;
    for (let q = Math.max(0, j - previo); q < j; q++) if (env[q] > UMBRAL_VOZ_DB) silencioAntes = false;
    if (silencioAntes && (arranques.length === 0 || j * paso_s - arranques[arranques.length - 1] > 0.1)) arranques.push(j * paso_s);
    // avanza hasta el próximo silencio
    while (i < env.length && env[i] > UMBRAL_VOZ_DB) i++;
  }
  return arranques;
}

function potenciaMediaDb(env: Float32Array, desde: number, hasta: number): number | null {
  const a = Math.max(0, desde);
  const b = Math.min(env.length, hasta);
  if (b - a < 2) return null;
  let suma = 0;
  for (let i = a; i < b; i++) suma += Math.pow(10, env[i] / 10);
  return 10 * Math.log10(suma / (b - a));
}

// Correlación de envolventes (en dB, con piso) de un pedazo de la original
// contra el final, probando corrimientos en [-max, +max] pasos.
function mejorCorrimiento(envO: Float32Array, desdeO: number, largo: number, envF: Float32Array, centroF: number, max: number, piso: number): number {
  const a: number[] = [];
  for (let i = 0; i < largo; i++) a.push(Math.max(piso, envO[desdeO + i] ?? piso));
  const ma = a.reduce((x, y) => x + y, 0) / largo;
  let mejor = 0;
  let mejorCorr = -Infinity;
  for (let k = -max; k <= max; k++) {
    const b: number[] = [];
    for (let i = 0; i < largo; i++) b.push(Math.max(piso, envF[centroF + k + i] ?? piso));
    const mb = b.reduce((x, y) => x + y, 0) / largo;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < largo; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db += (b[i] - mb) ** 2;
    }
    const corr = num / Math.sqrt(da * db + 1e-12);
    if (corr > mejorCorr) {
      mejorCorr = corr;
      mejor = k;
    }
  }
  return mejor;
}

function aFinal(t: number, tramos: TramoVoz[]): { final_s: number; tramo: number } | null {
  for (let k = 0; k < tramos.length; k++) {
    const { original: o, compactado: c } = tramos[k];
    if (t >= o.inicio_s - 1e-6 && t < o.fin_s) return { final_s: c.inicio_s + (t - o.inicio_s), tramo: k };
  }
  return null;
}

// Inicio (en la voz original) de la zona conservada sin cortes que contiene el tramo k.
function inicioZonaConservada(tramos: TramoVoz[], k: number): number {
  let inicio = tramos[k].original.inicio_s;
  for (let q = k - 1; q >= 0; q--) {
    if (Math.abs(tramos[q].original.fin_s - inicio) < 1e-3) inicio = tramos[q].original.inicio_s;
    else break;
  }
  return inicio;
}

export function controlarArranquesDeVoz(params: {
  original: AudioMono;
  final: AudioMono;
  tramos: TramoVoz[]; // todos los tramos de todas las escenas
  palabras?: { texto: string; inicio_s: number }[]; // en tiempo del video (compactado), solo para nombrar
}): ResultadoArranques {
  const tramos = [...params.tramos].sort((a, b) => a.original.inicio_s - b.original.inicio_s);
  const envO = envolventeDb(params.original);
  const envF = envolventeDb(params.final);
  const piso = UMBRAL_VOZ_DB - 15;
  const hallazgos: string[] = [];

  const nombrar = (finalS: number | null) => {
    if (finalS == null || !params.palabras?.length) return null;
    // Whisper suele marcar el inicio tarde: la primera palabra que empieza
    // poco antes o después del arranque medido.
    const p = params.palabras.find((x) => x.inicio_s >= finalS - 0.1) ?? params.palabras[params.palabras.length - 1];
    return Math.abs(p.inicio_s - finalS) < 0.6 ? p.texto.replace(/[.,;:!?¿¡"]/g, "") : null;
  };
  const donde = (a: ArranqueMedido) => `${a.palabra ? `"${a.palabra}" ` : "una palabra "}(segundo ${(a.final_s ?? a.original_s).toFixed(2)} del video)`;

  const arranques: ArranqueMedido[] = [];
  for (const t of arranquesDeVoz(envO)) {
    const destino = aFinal(t, tramos);
    const medido: ArranqueMedido = { original_s: t, final_s: destino?.final_s ?? null, palabra: null, margen_ms: null, perdida_db: null, desfase_ms: null };
    if (!destino) {
      // ¿Quedó a medias? Puede que el ataque esté cortado pero la palabra no.
      const siguiente = tramos.find((x) => x.original.inicio_s > t);
      const finalAprox = siguiente ? siguiente.compactado.inicio_s : null;
      medido.final_s = finalAprox;
      medido.palabra = nombrar(finalAprox);
      if (!siguiente || siguiente.original.inicio_s - t < 0.5) {
        hallazgos.push(`Se cortó el comienzo de ${donde(medido)}: ${siguiente ? Math.round((siguiente.original.inicio_s - t) * 1000) : "?"} ms de su arranque no quedaron en el video.`);
      }
      arranques.push(medido);
      continue;
    }
    medido.palabra = nombrar(destino.final_s);
    const zona = inicioZonaConservada(tramos, destino.tramo);
    medido.margen_ms = Math.round((t - zona) * 1000);
    if (zona > 1e-3 && t - zona < MARGEN_MINIMO_S - 0.005) {
      hallazgos.push(`El corte de pausa quedó a solo ${medido.margen_ms} ms del comienzo de ${donde(medido)} (mínimo ${MARGEN_MINIMO_S * 1000} ms).`);
    }
    const iO = Math.round(t / PASO_S);
    const iF = Math.round(destino.final_s / PASO_S);
    const antes = Math.round(VENTANA_ANTES_S / PASO_S);
    const despues = Math.round(VENTANA_DESPUES_S / PASO_S);
    const eO = potenciaMediaDb(envO, iO - antes, iO + despues);
    // Dónde está de verdad ese arranque en el video (corrimiento absoluto).
    const k = mejorCorrimiento(envO, iO - 2 * antes, antes * 2 + despues + 10, envF, iF - 2 * antes, Math.round(BUSQUEDA_LOCAL_S / PASO_S), piso);
    medido.desfase_ms = Math.round(k * PASO_S * 1000);
    const eF = potenciaMediaDb(envF, iF + k - antes, iF + k + despues);
    if (eO != null && eF != null) medido.perdida_db = Math.round((eO - eF) * 10) / 10;
    arranques.push(medido);
  }

  // Desfase global (el AAC suele correr todo el audio 10-30 ms): la mediana
  // de los arranques. Cada arranque se juzga contra ese global.
  const medianaDe = (xs: number[]) => {
    const o = [...xs].sort((a, b) => a - b);
    return o.length ? o[Math.floor(o.length / 2)] : 0;
  };
  const desfaseGlobal_ms = medianaDe(arranques.map((a) => a.desfase_ms).filter((x): x is number => x != null));
  if (Math.abs(desfaseGlobal_ms) > DESFASE_MAXIMO_MS) {
    hallazgos.push(`La voz del video quedó corrida ${desfaseGlobal_ms} ms respecto de los subtítulos y la imagen.`);
  }
  for (const a of arranques) if (a.desfase_ms != null) a.desfase_ms -= desfaseGlobal_ms;

  // Pérdida de energía respecto de la ganancia típica de la voz en el video
  // (la mezcla y el AAC cambian el nivel general; lo que importa es si UN
  // arranque llega más débil que el resto).
  const perdidas = arranques.map((a) => a.perdida_db).filter((x): x is number => x != null).sort((a, b) => a - b);
  const tipica = perdidas.length ? perdidas[Math.floor(perdidas.length / 2)] : 0;
  for (const a of arranques) {
    if (a.perdida_db != null && a.perdida_db - tipica > PERDIDA_MAXIMA_DB) {
      hallazgos.push(`El comienzo de ${donde(a)} llegó al video con ${(a.perdida_db - tipica).toFixed(1)} dB menos de energía que en la voz original (se oye cortado).`);
    }
    if (a.desfase_ms != null && Math.abs(a.desfase_ms) > DESFASE_MAXIMO_MS) {
      hallazgos.push(`El comienzo de ${donde(a)} quedó corrido ${a.desfase_ms} ms en el video.`);
    }
  }
  return { hallazgos, arranques, desfaseGlobal_ms };
}
