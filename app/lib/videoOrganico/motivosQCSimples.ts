// Motivos del control de calidad en lenguaje simple, para el cliente
// (lanzamiento 30 nov 2026). Los hallazgos guardados son técnicos ("cuadro
// 'inicio'", "revisa compactarPausas()"); admin los sigue viendo tal cual.
// Cada motivo dice qué se nota en el video, sin jerga, y sin repetirse.

type Regla = { patron: RegExp; motivo: string | ((h: string) => string) };

const REGLAS: Regla[] = [
  // La cuenta de OpenAI del cliente: el mensaje ya es para él.
  { patron: /cuenta de OpenAI|llave de OpenAI/i, motivo: (h) => h },
  { patron: /Falta (la primera palabra de una frase|una palabra) en el audio del video: "([^"]+)"/, motivo: (h) => `Falta la palabra "${h.match(/"([^"]+)"/)?.[1] ?? ""}" en la voz del video.` },
  { patron: /Se cortó el comienzo|comienzo de .* (llegó al video con|quedó corrido)|quedó a solo \d+ ms del comienzo|voz del video (quedó corrida|no pasó el control)/i, motivo: "Una parte de la voz salió cortada o desfasada." },
  { patron: /No se pudo verificar la voz/i, motivo: "No pudimos revisar la voz del video." },
  { patron: /salió en silencio/i, motivo: "El video salió sin sonido." },
  { patron: /de silencio real entre el segundo|pausas largas/i, motivo: "Quedaron pausas demasiado largas en la voz." },
  { patron: /pantalla vacía/i, motivo: "Una parte del video se ve vacía." },
  { patron: /texto encimado/i, motivo: "Hay textos encimados que no se leen bien." },
  { patron: /contraste bajo|subtítulo ilegible/i, motivo: "Algún texto no se lee bien sobre su fondo." },
  { patron: /no se ve lo que nombra la voz|se ve chico/i, motivo: "Lo que dice la voz no se ve con claridad en la imagen." },
  { patron: /el subtítulo tapa/i, motivo: "Los subtítulos tapan lo más importante de la imagen." },
  { patron: /objeto principal cortado/i, motivo: "Lo más importante de la imagen quedó cortado." },
  { patron: /foto con texto o captura/i, motivo: "La foto elegida tiene texto encima o es una captura de pantalla." },
  { patron: /no pudo revisar bien el cuadro/i, motivo: "No pudimos revisar bien la imagen del video." },
];

export const MOTIVO_GENERICO = "El video no pasó la revisión automática de calidad.";

export function motivosEnLenguajeSimple(hallazgos: unknown): string[] {
  const lista = Array.isArray(hallazgos) ? hallazgos.filter((h): h is string => typeof h === "string") : [];
  const motivos: string[] = [];
  for (const h of lista) {
    // Un hallazgo puede traer varios problemas ("pantalla vacía, texto encimado").
    const encontrados = REGLAS.filter((r) => r.patron.test(h)).map((r) => (typeof r.motivo === "string" ? r.motivo : r.motivo(h)));
    for (const m of encontrados.length ? encontrados : [MOTIVO_GENERICO]) if (!motivos.includes(m)) motivos.push(m);
  }
  return motivos.length ? motivos : [MOTIVO_GENERICO];
}
