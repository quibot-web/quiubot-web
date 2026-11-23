// Calidad y tamaño del video que arma el navegador (23 nov 2026).
// Sin bitrate fijo el codificador elegía ~3.3-3.5 Mbps y un reel de ~50 s
// podía pasar de 24 MB, donde Next.js TRUNCA la subida en silencio
// (proxyClientMaxBodySize 25mb en next.config.ts). Instagram vuelve a
// codificar todo reel que recibe, así que 2.5 Mbps a 1080x1920 no se nota.
export const BITRATE_VIDEO_REEL = 2_500_000;
export const BITRATE_AUDIO_REEL = 128_000;

// Margen bajo los 25 MB que el servidor acepta sin truncar.
export const TAMANO_MAXIMO_VIDEO_BYTES = 24 * 1024 * 1024;

// El reel más largo que puede salir: "Tu idea" pide ~50 s y las pausas
// reales (0.4 s entre frases) lo alargan; 60 s cubre ese caso con margen.
export const DURACION_MAXIMA_REEL_S = 60;

// Cuánto se pasa el codificador de su bitrate objetivo, medido en renders
// reales en Chrome (ver video/configRender.test.ts). Se usa con margen.
export const SOBRECOSTO_MEDIDO = 1.06;

export function tamanoEstimadoBytes(duracion_s: number, sobrecosto = SOBRECOSTO_MEDIDO): number {
  return Math.ceil((((BITRATE_VIDEO_REEL + BITRATE_AUDIO_REEL) * duracion_s) / 8) * sobrecosto);
}

// Opciones que van a renderMediaOnWeb en TODOS los renders de reels.
export const OPCIONES_CODIFICACION_REEL = { videoBitrate: BITRATE_VIDEO_REEL, audioBitrate: BITRATE_AUDIO_REEL } as const;
