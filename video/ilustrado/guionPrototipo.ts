// Narración del prototipo ilustrado "Por qué tus anuncios no venden"
// (aprobada por Juan José, 18 nov 2026). Una frase por escena.
import type { TiemposIlustrado } from "./tiempoIlustrado";

export const NARRACION_PROTOTIPO = [
  { id: "e1", narracion: "Pagas anuncios… y nadie te compra." },
  { id: "e2", narracion: "La gente ve tu anuncio y pasa de largo." },
  { id: "e3", narracion: "Y cada vez que pasa, se te va una moneda." },
  { id: "e4", narracion: "Primer error: le hablas a todo el mundo." },
  { id: "e5", narracion: "Elige a quién, y se iluminan los que sí pueden comprarte." },
  { id: "e6", narracion: "Segundo: tu foto no detiene el dedo." },
  { id: "e7", narracion: "Una foto clara, con el producto en uso, sí lo detiene." },
  { id: "e8", narracion: "Tercero: te escriben… y nadie responde." },
  { id: "e9", narracion: "Responde rápido y ese mensaje se vuelve venta." },
  { id: "e10", narracion: "Así tu presupuesto deja de irse… y empieza a volver." },
  { id: "e11", narracion: "Sigue a Quiubot para más trucos de anuncios." },
];

// Tiempos de relleno (0,3 s por palabra) para Remotion Studio y para que
// la composición exista sin la voz real; el mp4 usa los tiempos reales.
export function tiemposSinteticos(): TiemposIlustrado {
  let t = 0;
  const tiemposRender: TiemposIlustrado["tiemposRender"] = [];
  const palabrasPorEscena: TiemposIlustrado["palabrasPorEscena"] = [];
  for (const e of NARRACION_PROTOTIPO) {
    const inicio = t;
    const palabras = e.narracion.split(/\s+/).map((texto) => {
      const p = { texto, inicio_s: t, fin_s: t + 0.25 };
      t += 0.3;
      return p;
    });
    t += 0.2;
    tiemposRender.push({ escena_id: e.id, inicio_s: inicio, fin_s: t });
    palabrasPorEscena.push({ escena_id: e.id, palabras });
  }
  return { tiemposRender, palabrasPorEscena, segmentosAudio: tiemposRender.map((r) => ({ escena_id: r.escena_id, tramos: [] })) };
}
