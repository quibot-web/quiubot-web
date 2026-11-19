// Geometría del mundo del prototipo ilustrado y recorrido de la cámara
// (puro, sin React, para poder probarlo). Ronda 2 (18 nov 2026): lo que
// la voz nombra ocupa al menos la mitad de la pantalla en ese momento --
// la cámara se acerca a cada objeto (billetera + monedas, multitud,
// elegidos, reloj + cliente, billetera + gráfica) y el plano general del
// final muestra solo dos elementos grandes.
import type { LineaDeTiempo, PuntoCamara } from "./tiempoIlustrado";

export type Rect = { x: number; y: number; ancho: number; alto: number };

export const ANCHO_PANTALLA = 1080;
export const ALTO_PANTALLA = 1920;
// Franja vertical que no tapa nada: debajo del subtítulo (14,5% + píldora)
// y encima de la interfaz de Instagram abajo (20%).
export const FRANJA_SEGURA = { arriba: 403, abajo: 1536 };
const CENTRO_FRANJA = (FRANJA_SEGURA.arriba + FRANJA_SEGURA.abajo) / 2;

// ---------- objetos ----------
export const CELULAR = { x: 820, y: 550, ancho: 760, alto: 1520, borde: 30 };
export const PANTALLA = { ancho: CELULAR.ancho - CELULAR.borde * 2, alto: CELULAR.alto - CELULAR.borde * 2 };
export const RECT_PANTALLA: Rect = { x: CELULAR.x + CELULAR.borde, y: CELULAR.y + CELULAR.borde, ancho: PANTALLA.ancho, alto: PANTALLA.alto };

export const BILLETERA: Rect = { x: 80, y: 1480, ancho: 600, alto: 450 };
export const BOCA_BILLETERA = { x: BILLETERA.x + BILLETERA.ancho / 2, y: BILLETERA.y + 130 };
export const TAM_MONEDA = 260;
export const GRAFICA: Rect = { x: 90, y: 800, ancho: 580, alto: 600 };
export const RELOJ = { cx: 1870, cy: 1350, tamano: 480 };
export const CLIENTE = { x: 2300, pies: 2120, escala: 3.6 };

// Persona: dibujo base de 140 x 280, (x, pies) = centro abajo.
export function rectPersona(x: number, pies: number, escala: number): Rect {
  return { x: x - 70 * escala, y: pies - 280 * escala, ancho: 140 * escala, alto: 280 * escala };
}

// Multitud: pocas filas de personas grandes; la de adelante más grande.
const FILAS = [
  { pies: 2900, escala: 1.8, cantidad: 7, paso: 270 },
  { pies: 3150, escala: 2.1, cantidad: 6, paso: 310 },
  { pies: 3420, escala: 2.4, cantidad: 5, paso: 350 },
];
const CENTRO_MULTITUD_X = 1000;
export const MULTITUD = FILAS.flatMap((f, fi) =>
  Array.from({ length: f.cantidad }, (_, k) => ({ id: `${fi}-${k}`, fila: fi, x: CENTRO_MULTITUD_X + (k - (f.cantidad - 1) / 2) * f.paso + (fi % 2) * 30, pies: f.pies, escala: f.escala }))
);
// "Los que sí pueden comprarte": un grupo junto, para poder acercarse.
export const ILUMINADOS = new Set(["1-2", "2-1", "2-3"]);

export function union(...rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, ancho: Math.max(...rs.map((r) => r.x + r.ancho)) - x, alto: Math.max(...rs.map((r) => r.y + r.alto)) - y };
}

const rectReloj: Rect = { x: RELOJ.cx - RELOJ.tamano / 2, y: RELOJ.cy - RELOJ.tamano / 2, ancho: RELOJ.tamano, alto: RELOJ.tamano };
export const RECTS = {
  pantalla: RECT_PANTALLA,
  billetera: BILLETERA,
  multitud: union(...MULTITUD.map((p) => rectPersona(p.x, p.pies, p.escala))),
  elegidos: union(...MULTITUD.filter((p) => ILUMINADOS.has(p.id)).map((p) => rectPersona(p.x, p.pies, p.escala))),
  relojYCliente: union(rectReloj, rectPersona(CLIENTE.x, CLIENTE.pies, CLIENTE.escala)),
  billeteraYGrafica: union(BILLETERA, GRAFICA),
};

type Encuadre = { x: number; y: number; zoom: number };

// Encuadra un rectángulo para que quepa en la franja segura y la llene.
export function encuadre(r: Rect, zoomMaximo = 3): Encuadre {
  const zoom = Math.min(1000 / r.ancho, (FRANJA_SEGURA.abajo - FRANJA_SEGURA.arriba - 30) / r.alto, zoomMaximo);
  return { x: r.x + r.ancho / 2, y: r.y + r.alto / 2 - (CENTRO_FRANJA - ALTO_PANTALLA / 2) / zoom, zoom };
}

const CENTRO_CELULAR = { x: CELULAR.x + CELULAR.ancho / 2, y: CELULAR.y + CELULAR.alto / 2 };
export const CERCA_PANTALLA: Encuadre = { x: CENTRO_CELULAR.x, y: CENTRO_CELULAR.y - 20, zoom: 1.36 };
// Chat: los mensajes van en la parte alta de la pantalla del celular.
const CERCA_CHAT: Encuadre = { x: CENTRO_CELULAR.x, y: CELULAR.y + 640, zoom: 1.5 };
const MARCO_BILLETERA = encuadre(union(BILLETERA, { x: BILLETERA.x, y: BILLETERA.y - 260, ancho: BILLETERA.ancho, alto: 260 }), 1.3);
const MARCO_MULTITUD: Encuadre = { x: CENTRO_MULTITUD_X, y: 2960, zoom: 0.8 };
const MARCO_ELEGIDOS = encuadre(RECTS.elegidos);
const MARCO_RELOJ_CLIENTE = encuadre(RECTS.relojYCliente);
const MARCO_FINAL = encuadre(RECTS.billeteraYGrafica);

// ---------- eventos: el cuadro de cada palabra que dispara un cambio ----------
export function eventosDe(l: LineaDeTiempo) {
  const w = l.cuadroDePalabra;
  return {
    e1: { anuncios: w("e1", 1), y: w("e1", 2), nadie: w("e1", 3), compra: w("e1", 5) },
    e2: { inicio: w("e2", 0), gente: w("e2", 1), ve: w("e2", 2), anuncio: w("e2", 4), pasa: w("e2", 6), largo: w("e2", 8) },
    e3: { inicio: w("e3", 0), pasa: w("e3", 4), va: w("e3", 7), moneda: w("e3", 9) },
    e4: { primer: w("e4", 0), hablas: w("e4", 3), mundo: w("e4", 7) },
    e5: { elige: w("e5", 0), quien: w("e5", 2), iluminan: w("e5", 5), comprarte: w("e5", 10) },
    e6: { segundo: w("e6", 0), foto: w("e6", 2), detiene: w("e6", 4), dedo: w("e6", 6) },
    e7: { foto: w("e7", 1), clara: w("e7", 2), producto: w("e7", 5), detiene: w("e7", 10) },
    e8: { tercero: w("e8", 0), te: w("e8", 1), escriben: w("e8", 2), nadie: w("e8", 4), responde: w("e8", 5) },
    e9: { responde: w("e9", 0), rapido: w("e9", 1), mensaje: w("e9", 4), vuelve: w("e9", 6), venta: w("e9", 7) },
    e10: { asi: w("e10", 0), presupuesto: w("e10", 2), irse: w("e10", 5), empieza: w("e10", 7), volver: w("e10", 9) },
    e11: { sigue: w("e11", 0), quiubot: w("e11", 2) },
  };
}
export type Eventos = ReturnType<typeof eventosDe>;

export const MOVER = 16; // ~0,5 s por movimiento de cámara

export function puntosCamara(ev: Eventos, total: number): PuntoCamara[] {
  const p = (cuadro: number, c: Encuadre) => ({ cuadro, ...c });
  const acercar = (c: Encuadre, f: number) => ({ ...c, zoom: c.zoom * f });
  return [
    p(0, CERCA_PANTALLA),
    p(ev.e1.compra, acercar(CERCA_PANTALLA, 1.04)),
    // e2: se abre un poco -- el celular sigue llenando la pantalla.
    p(ev.e2.gente, acercar(CERCA_PANTALLA, 1.03)),
    p(ev.e2.gente + MOVER, { ...CERCA_PANTALLA, zoom: 1.15 }),
    // e3: billetera grande con sus monedas.
    p(ev.e3.inicio, { ...CERCA_PANTALLA, zoom: 1.12 }),
    p(ev.e3.inicio + MOVER + 4, MARCO_BILLETERA),
    p(ev.e3.moneda, acercar(MARCO_BILLETERA, 1.04)),
    // e4: sigue la última moneda hacia abajo, a la multitud.
    p(ev.e4.primer, acercar(MARCO_BILLETERA, 1.04)),
    p(ev.e4.primer + MOVER + 8, MARCO_MULTITUD),
    p(ev.e5.iluminan, acercar(MARCO_MULTITUD, 1.03)),
    // e5: se acerca a los elegidos.
    p(ev.e5.iluminan + 14, MARCO_ELEGIDOS),
    p(ev.e6.segundo, acercar(MARCO_ELEGIDOS, 1.04)),
    // e6-e7: de vuelta al celular.
    p(ev.e6.segundo + MOVER + 8, CERCA_PANTALLA),
    p(ev.e7.detiene, acercar(CERCA_PANTALLA, 1.07)),
    // e8: el chat de cerca; en "y nadie responde", reloj y cliente grandes.
    p(ev.e8.tercero, acercar(CERCA_PANTALLA, 1.06)),
    p(ev.e8.tercero + MOVER, CERCA_CHAT),
    p(ev.e8.escriben + 6, CERCA_CHAT),
    p(ev.e8.escriben + 6 + MOVER, MARCO_RELOJ_CLIENTE),
    p(ev.e9.responde, acercar(MARCO_RELOJ_CLIENTE, 1.03)),
    // e9: vuelve al chat; la venta vuela a la billetera.
    p(ev.e9.responde + MOVER, CERCA_CHAT),
    p(ev.e9.venta, acercar(CERCA_CHAT, 1.03)),
    // e10: la billetera grande ("tu presupuesto deja de irse") y, en
    // "empieza", plano corto de solo dos elementos: billetera + gráfica.
    p(ev.e9.venta + 20, MARCO_BILLETERA),
    p(ev.e10.empieza, acercar(MARCO_BILLETERA, 1.04)),
    p(ev.e10.empieza + MOVER, MARCO_FINAL),
    p(ev.e11.sigue, acercar(MARCO_FINAL, 1.06)),
    // e11: al perfil.
    p(ev.e11.sigue + MOVER + 4, CERCA_PANTALLA),
    p(total, acercar(CERCA_PANTALLA, 1.03)),
  ];
}

// Qué nombra la voz en cada momento, y el cuadro en que la cámara ya
// llegó (lo usa la prueba de escala).
export function enfoques(ev: Eventos): { palabra: string; cuadro: number; rect: Rect }[] {
  return [
    { palabra: "anuncios", cuadro: ev.e1.anuncios + 4, rect: RECTS.pantalla },
    { palabra: "anuncio (e2)", cuadro: ev.e2.anuncio, rect: RECTS.pantalla },
    { palabra: "moneda", cuadro: ev.e3.moneda, rect: RECTS.billetera },
    { palabra: "mundo", cuadro: ev.e4.mundo, rect: RECTS.multitud },
    { palabra: "comprarte", cuadro: ev.e5.comprarte, rect: RECTS.elegidos },
    { palabra: "foto (e6)", cuadro: ev.e6.foto, rect: RECTS.pantalla },
    { palabra: "producto", cuadro: ev.e7.producto, rect: RECTS.pantalla },
    { palabra: "escriben", cuadro: ev.e8.escriben, rect: RECTS.pantalla },
    { palabra: "responde (e8)", cuadro: ev.e8.responde + 12, rect: RECTS.relojYCliente },
    { palabra: "mensaje", cuadro: ev.e9.mensaje, rect: RECTS.pantalla },
    { palabra: "presupuesto", cuadro: ev.e10.presupuesto, rect: RECTS.billetera },
    { palabra: "volver", cuadro: ev.e10.volver, rect: RECTS.billeteraYGrafica },
    { palabra: "Quiubot", cuadro: ev.e11.quiubot, rect: RECTS.pantalla },
  ];
}

// Rectángulo en pantalla (recortado a la pantalla) con la cámara dada.
export function rectEnPantalla(r: Rect, cam: Encuadre): Rect {
  const x0 = Math.max(0, ANCHO_PANTALLA / 2 + (r.x - cam.x) * cam.zoom);
  const y0 = Math.max(0, ALTO_PANTALLA / 2 + (r.y - cam.y) * cam.zoom);
  const x1 = Math.min(ANCHO_PANTALLA, ANCHO_PANTALLA / 2 + (r.x + r.ancho - cam.x) * cam.zoom);
  const y1 = Math.min(ALTO_PANTALLA, ALTO_PANTALLA / 2 + (r.y + r.alto - cam.y) * cam.zoom);
  return { x: x0, y: y0, ancho: Math.max(0, x1 - x0), alto: Math.max(0, y1 - y0) };
}
