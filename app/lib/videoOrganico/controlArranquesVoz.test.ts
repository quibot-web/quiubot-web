import { describe, expect, it } from "vitest";
import { controlarArranquesDeVoz, type TramoVoz } from "./controlArranquesVoz";

// Voz sintética: palabras = ráfagas con ataque de 30 ms, separadas por
// silencio de piso (-70 dB). El "video final" se arma colocando cada tramo
// en su posición compactada, igual que el render.
const SR = 16000;
let semilla = 3;
const ruido = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647) * 2 - 1;

type Palabra = { texto: string; inicio: number; dur: number };
const PALABRAS: Palabra[] = [
  { texto: "Hola", inicio: 0.3, dur: 0.4 },
  { texto: "amigos.", inicio: 0.75, dur: 0.5 },
  // pausa larga entre frases (1.25 -> 2.4)
  { texto: "Escribe", inicio: 2.4, dur: 0.45 },
  { texto: "una", inicio: 2.9, dur: 0.3 },
  // pausa larga (3.2 -> 4.3)
  { texto: "Sigue", inicio: 4.3, dur: 0.5 },
];
const DURACION = 5.2;

function vozOriginal(): Float32Array {
  const m = new Float32Array(Math.round(DURACION * SR));
  for (let i = 0; i < m.length; i++) m[i] = ruido() * 0.0003; // piso ~ -70 dB
  for (const p of PALABRAS) {
    const a = Math.round(p.inicio * SR);
    const n = Math.round(p.dur * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const ataque = Math.min(1, t / 0.03);
      const caida = Math.min(1, (p.dur - t) / 0.03);
      m[a + i] += 0.3 * ataque * caida * (Math.sin(2 * Math.PI * 220 * t) * 0.6 + ruido() * 0.4);
    }
  }
  return m;
}

function armarFinal(original: Float32Array, tramos: TramoVoz[], ajustes: { corrimiento_s?: (k: number) => number; silenciar?: { tramo: number; desde_s: number; hasta_s: number } } = {}): Float32Array {
  const fin = Math.max(...tramos.map((t) => t.compactado.fin_s)) + 0.3;
  const m = new Float32Array(Math.round(fin * SR));
  tramos.forEach((t, k) => {
    const a = Math.round(t.original.inicio_s * SR);
    const b = Math.round(t.original.fin_s * SR);
    const x = Math.round((t.compactado.inicio_s + (ajustes.corrimiento_s?.(k) ?? 0)) * SR);
    for (let i = a; i < b; i++) {
      const rel = (i - a) / SR;
      if (ajustes.silenciar && ajustes.silenciar.tramo === k && rel >= ajustes.silenciar.desde_s && rel < ajustes.silenciar.hasta_s) continue;
      if (x + i - a >= 0 && x + i - a < m.length) m[x + i - a] += original[i];
    }
  });
  return m;
}

// Compactación correcta: cada corte deja 0.2 s de silencio a cada lado.
const TRAMOS_BIEN: TramoVoz[] = [
  { original: { inicio_s: 0, fin_s: 1.45 }, compactado: { inicio_s: 0, fin_s: 1.45 } },
  { original: { inicio_s: 2.2, fin_s: 3.4 }, compactado: { inicio_s: 1.45, fin_s: 2.65 } },
  { original: { inicio_s: 4.1, fin_s: 5.2 }, compactado: { inicio_s: 2.65, fin_s: 3.75 } },
];
const palabrasVideo = (tramos: TramoVoz[]) =>
  PALABRAS.map((p) => {
    const t = tramos.find((x) => p.inicio + 0.15 >= x.original.inicio_s && p.inicio < x.original.fin_s)!;
    return { texto: p.texto, inicio_s: t.compactado.inicio_s + p.inicio + 0.25 - t.original.inicio_s }; // Whisper marca 250 ms tarde
  });

describe("control de arranques de voz (energía del video final vs. voz TTS original)", () => {
  const original = vozOriginal();

  it("compactación con margen y render fiel: pasa, y encuentra el arranque de cada frase", () => {
    const r = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: armarFinal(original, TRAMOS_BIEN), sampleRate: SR }, tramos: TRAMOS_BIEN, palabras: palabrasVideo(TRAMOS_BIEN) });
    expect(r.hallazgos).toEqual([]);
    const inicios = r.arranques.map((a) => Math.round(a.original_s * 100) / 100);
    expect(inicios).toEqual(expect.arrayContaining([0.3, 2.4, 4.3]));
  });

  it("primera palabra de la frase cortada (el tramo arranca 80 ms DESPUÉS de que la voz de 'Escribe' empezó): no pasa, y dice cuál", () => {
    const tramos: TramoVoz[] = [TRAMOS_BIEN[0], { original: { inicio_s: 2.48, fin_s: 3.4 }, compactado: { inicio_s: 1.45, fin_s: 2.37 } }, { original: { inicio_s: 4.1, fin_s: 5.2 }, compactado: { inicio_s: 2.37, fin_s: 3.47 } }];
    const r = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: armarFinal(original, tramos), sampleRate: SR }, tramos, palabras: palabrasVideo(tramos) });
    expect(r.hallazgos.join(" ")).toMatch(/Se cortó el comienzo de "Escribe"/);
  });

  it("corte en silencio pero a menos de 120 ms del arranque: no pasa", () => {
    const tramos: TramoVoz[] = [TRAMOS_BIEN[0], { original: { inicio_s: 2.34, fin_s: 3.4 }, compactado: { inicio_s: 1.45, fin_s: 2.51 } }, { original: { inicio_s: 4.1, fin_s: 5.2 }, compactado: { inicio_s: 2.51, fin_s: 3.61 } }];
    const r = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: armarFinal(original, tramos), sampleRate: SR }, tramos, palabras: palabrasVideo(tramos) });
    expect(r.hallazgos.join(" ")).toMatch(/quedó a solo \d+ ms del comienzo de "Escribe"/);
  });

  it("el render pierde el ataque de una palabra aunque la compactación esté bien (100 ms en silencio al inicio de 'Sigue'): no pasa por energía", () => {
    const final = armarFinal(original, TRAMOS_BIEN, { silenciar: { tramo: 2, desde_s: 0.2, hasta_s: 0.3 } });
    const r = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: final, sampleRate: SR }, tramos: TRAMOS_BIEN, palabras: palabrasVideo(TRAMOS_BIEN) });
    expect(r.hallazgos.join(" ")).toMatch(/comienzo de "Sigue".*(dB menos de energía|corrido)/);
  });

  it("un tramo que el render corre 60 ms: no pasa (desplazado más de 40 ms)", () => {
    const final = armarFinal(original, TRAMOS_BIEN, { corrimiento_s: (k) => (k === 1 ? 0.06 : 0) });
    const r = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: final, sampleRate: SR }, tramos: TRAMOS_BIEN, palabras: palabrasVideo(TRAMOS_BIEN) });
    expect(r.hallazgos.join(" ")).toMatch(/"Escribe".*corrido 6\d ms/);
  });

  it("toda la voz corrida 20 ms (lo normal del AAC): pasa; corrida 80 ms: no pasa", () => {
    const leve = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: armarFinal(original, TRAMOS_BIEN, { corrimiento_s: () => 0.02 }), sampleRate: SR }, tramos: TRAMOS_BIEN });
    expect(leve.hallazgos).toEqual([]);
    const fuerte = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: armarFinal(original, TRAMOS_BIEN, { corrimiento_s: () => 0.08 }), sampleRate: SR }, tramos: TRAMOS_BIEN });
    expect(fuerte.hallazgos.join(" ")).toMatch(/La voz del video quedó corrida 8\d ms/);
  });

  it("con música de fondo baja (como el ducking real): sigue pasando si la voz está entera", () => {
    const final = armarFinal(original, TRAMOS_BIEN);
    for (let i = 0; i < final.length; i++) final[i] += 0.01 * Math.sin((2 * Math.PI * 110 * i) / SR);
    const r = controlarArranquesDeVoz({ original: { muestras: original, sampleRate: SR }, final: { muestras: final, sampleRate: SR }, tramos: TRAMOS_BIEN });
    expect(r.hallazgos).toEqual([]);
  });
});
