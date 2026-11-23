// Utilidades de animación del reel ilustrado (puras).
export function rampa(frame: number, desde: number | undefined, duracion: number): number {
  if (desde === undefined || frame <= desde) return 0;
  if (frame >= desde + duracion) return 1;
  const t = (frame - desde) / duracion;
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Interpola entre pares [cuadro, valor] (con la misma suavidad que rampa).
export function claves(pares: [number, number][], frame: number): number {
  const p = [...pares].sort((a, b) => a[0] - b[0]);
  if (frame <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (frame <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * rampa(frame, p[i - 1][0], p[i][0] - p[i - 1][0]);
  }
  return p[p.length - 1][1];
}

// Primer cuadro de una acción (o undefined si no está en el plan).
export const primero = (cuadros: number[] | undefined) => cuadros?.[0];
// Cuántas veces ya se disparó una acción hasta este cuadro.
export const cuantas = (cuadros: number[] | undefined, frame: number) => (cuadros ?? []).filter((c) => frame >= c).length;
// El último disparo de una acción hasta este cuadro.
export const ultimo = (cuadros: number[] | undefined, frame: number) => [...(cuadros ?? [])].reverse().find((c) => frame >= c);

// Micro-acción (gesto neutro): 0 -> 1 -> 0 en ~0,8 s después de cada disparo.
export function latido(frame: number, cuadros: number[] | undefined, duracion = 24): number {
  let v = 0;
  for (const c of cuadros ?? []) {
    const t = frame - c;
    if (t >= 0 && t <= duracion) v = Math.max(v, Math.sin((t / duracion) * Math.PI));
  }
  return v;
}

