// Geometría de pantalla del reel ilustrado (pura).
export type Rect = { x: number; y: number; ancho: number; alto: number };
export type Encuadre = { x: number; y: number; zoom: number };

export const ANCHO_PANTALLA = 1080;
export const ALTO_PANTALLA = 1920;
// Franja vertical que no tapa nada: debajo del subtítulo (14,5% + píldora)
// y encima de la interfaz de Instagram abajo (20%).
export const FRANJA_SEGURA = { arriba: 403, abajo: 1536 };
const CENTRO_FRANJA = (FRANJA_SEGURA.arriba + FRANJA_SEGURA.abajo) / 2;
export const ZOOM_MAXIMO = 1.3;

// Encuadra un rectángulo del mundo para que quepa en la franja segura y
// la llene (>= 50% del ancho o del alto de la pantalla).
// "arriba": el tope del rectángulo queda justo debajo del subtítulo
// (pantallas del celular: nada de la app queda bajo el subtítulo).
export const TOPE_BAJO_SUBTITULO = FRANJA_SEGURA.arriba + 8;
// Borde inferior real de la píldora del subtítulo (top 14,5% + alto), con margen.
export const FONDO_SUBTITULO = 360;

// Acerca la cámara un factor; "arriba": manteniendo fijo lo que está en
// TOPE_BAJO_SUBTITULO (el celular no se mete bajo el subtítulo).
export function acercar(e: Encuadre, factor: number, alinear: "centro" | "arriba" = "centro"): Encuadre {
  const zoom = e.zoom * factor;
  if (alinear === "centro") return { ...e, zoom };
  const mundoEnTope = e.y + (TOPE_BAJO_SUBTITULO - ALTO_PANTALLA / 2) / e.zoom;
  return { x: e.x, y: mundoEnTope - (TOPE_BAJO_SUBTITULO - ALTO_PANTALLA / 2) / zoom, zoom };
}
export function encuadre(r: Rect, zoomMaximo = ZOOM_MAXIMO, alinear: "centro" | "arriba" = "centro"): Encuadre {
  if (alinear === "arriba") {
    const zoom = Math.min(1000 / r.ancho, (FRANJA_SEGURA.abajo - TOPE_BAJO_SUBTITULO) / r.alto, zoomMaximo);
    return { x: r.x + r.ancho / 2, y: r.y + (ALTO_PANTALLA / 2 - TOPE_BAJO_SUBTITULO) / zoom, zoom };
  }
  const zoom = Math.min(1000 / r.ancho, (FRANJA_SEGURA.abajo - FRANJA_SEGURA.arriba - 30) / r.alto, zoomMaximo);
  return { x: r.x + r.ancho / 2, y: r.y + r.alto / 2 - (CENTRO_FRANJA - ALTO_PANTALLA / 2) / zoom, zoom };
}

// Rectángulo en pantalla (recortado a la pantalla) con la cámara dada.
export function rectEnPantalla(r: Rect, cam: Encuadre): Rect {
  const x0 = Math.max(0, ANCHO_PANTALLA / 2 + (r.x - cam.x) * cam.zoom);
  const y0 = Math.max(0, ALTO_PANTALLA / 2 + (r.y - cam.y) * cam.zoom);
  const x1 = Math.min(ANCHO_PANTALLA, ANCHO_PANTALLA / 2 + (r.x + r.ancho - cam.x) * cam.zoom);
  const y1 = Math.min(ALTO_PANTALLA, ALTO_PANTALLA / 2 + (r.y + r.alto - cam.y) * cam.zoom);
  return { x: x0, y: y0, ancho: Math.max(0, x1 - x0), alto: Math.max(0, y1 - y0) };
}

// Fracción de pantalla que ocupa (máximo entre ancho y alto).
export function ocupacion(r: Rect, cam: Encuadre): number {
  const p = rectEnPantalla(r, cam);
  return Math.max(p.ancho / ANCHO_PANTALLA, p.alto / ALTO_PANTALLA);
}

// Parte del mundo que se ve con la cámara dada.
export function vistaDelMundo(cam: Encuadre): Rect {
  const ancho = ANCHO_PANTALLA / cam.zoom;
  const alto = ALTO_PANTALLA / cam.zoom;
  return { x: cam.x - ancho / 2, y: cam.y - alto / 2, ancho, alto };
}

export function seTocan(a: Rect, b: Rect, margen = 0): boolean {
  return a.x - margen < b.x + b.ancho && b.x - margen < a.x + a.ancho && a.y - margen < b.y + b.alto && b.y - margen < a.y + a.alto;
}

export function desplazar(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, ancho: r.ancho, alto: r.alto };
}
