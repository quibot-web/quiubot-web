// Catálogo de escenas del reel ilustrado (fase 1 del plan aprobado el
// 18 nov 2026): las escenas que salen del prototipo, cada una con las
// acciones que una palabra de la narración puede disparar y la zona que
// la cámara tiene que mostrar en cada acción (para que lo nombrado ocupe
// al menos media pantalla). Puro: lo usan el motor, la cámara, el
// validador del guion (fase 2) y las pruebas.
//
// Dos clases de escena:
// - "celular": pantallas de UN mismo celular (feed, chat, perfil); el
//   celular es una sola isla del mundo y cambia de pantalla.
// - "isla": un objeto del mundo con su propio lugar (billetera,
//   multitud, reloj + cliente, gráfica).
import type { Rect } from "./geometria";

export const CELULAR_ISLA = { ancho: 760, alto: 1520, borde: 30 };
export const PANTALLA = { ancho: CELULAR_ISLA.ancho - CELULAR_ISLA.borde * 2, alto: CELULAR_ISLA.alto - CELULAR_ISLA.borde * 2 };
const B = CELULAR_ISLA.borde;

// Zonas de la pantalla del celular (coordenadas de la isla del celular).
// Todas empiezan en el TOPE de la pantalla: la cámara las ancla justo
// debajo del subtítulo (encuadre "arriba"), así el subtítulo nunca tapa
// el encabezado ni el texto de la app (QC de staging, 23 nov 2026).
export const ALTO_BARRA_APP = 130; // = ALTO_BARRA_FEED de Objetos.tsx
export const ALTO_POST_FEED = 920; // = ALTO_POST de Objetos.tsx
const ZONA_POST: Rect = { x: B, y: B, ancho: PANTALLA.ancho, alto: ALTO_BARRA_APP + ALTO_POST_FEED };
// La publicación misma (lo nombrado en las acciones del feed), debajo de la barra.
export const POST_NOMBRADO: Rect = { x: B, y: B + ALTO_BARRA_APP, ancho: PANTALLA.ancho, alto: ALTO_POST_FEED };
const ZONA_CHAT: Rect = { x: B, y: B, ancho: PANTALLA.ancho, alto: 1030 };
const ZONA_PERFIL: Rect = { x: B, y: B, ancho: PANTALLA.ancho, alto: 1030 };
// La publicación propia con su botón "Promocionar" (debajo de los Me gusta).
const ZONA_PUBLICACION: Rect = { x: B, y: B, ancho: PANTALLA.ancho, alto: 1110 };

// Billetera: 600 x 450 abajo, con lugar arriba para las monedas que saltan.
export const BILLETERA_LOCAL: Rect = { x: 80, y: 450, ancho: 600, alto: 450 };
export const BOCA_BILLETERA_LOCAL = { x: BILLETERA_LOCAL.x + BILLETERA_LOCAL.ancho / 2, y: BILLETERA_LOCAL.y + 130 };
const ZONA_BILLETERA: Rect = { x: BILLETERA_LOCAL.x, y: BILLETERA_LOCAL.y - 260, ancho: BILLETERA_LOCAL.ancho, alto: BILLETERA_LOCAL.alto + 260 };

export const GRAFICA_LOCAL: Rect = { x: 30, y: 40, ancho: 580, alto: 600 };

// Multitud: tres filas, la de adelante más grande.
export const FILAS_MULTITUD = [
  { pies: 650, escala: 1.8, cantidad: 7, paso: 270 },
  { pies: 900, escala: 2.1, cantidad: 6, paso: 310 },
  { pies: 1170, escala: 2.4, cantidad: 5, paso: 350 },
];
const CENTRO_MULTITUD = 1000;
export const PERSONAS_MULTITUD = FILAS_MULTITUD.flatMap((f, fi) =>
  Array.from({ length: f.cantidad }, (_, k) => ({ id: `${fi}-${k}`, fila: fi, x: CENTRO_MULTITUD + (k - (f.cantidad - 1) / 2) * f.paso + (fi % 2) * 30, pies: f.pies, escala: f.escala }))
);
export const ELEGIDOS_MULTITUD = new Set(["1-2", "2-1", "2-3"]);
export function rectPersona(x: number, pies: number, escala: number): Rect {
  return { x: x - 70 * escala, y: pies - 280 * escala, ancho: 140 * escala, alto: 280 * escala };
}
const ZONA_MULTITUD: Rect = { x: CENTRO_MULTITUD - 675, y: 200, ancho: 1350, alto: 970 };
const ZONA_ELEGIDOS: Rect = unionRects(PERSONAS_MULTITUD.filter((p) => ELEGIDOS_MULTITUD.has(p.id)).map((p) => rectPersona(p.x, p.pies, p.escala)));

// Reloj grande junto a un cliente grande.
export const RELOJ_LOCAL = { cx: 240, cy: 400, tamano: 480 };
export const CLIENTE_LOCAL = { x: 670, pies: 1100, escala: 3.6 };
const ZONA_RELOJ_CLIENTE: Rect = unionRects([
  { x: RELOJ_LOCAL.cx - RELOJ_LOCAL.tamano / 2, y: RELOJ_LOCAL.cy - RELOJ_LOCAL.tamano / 2, ancho: RELOJ_LOCAL.tamano, alto: RELOJ_LOCAL.tamano },
  rectPersona(CLIENTE_LOCAL.x, CLIENTE_LOCAL.pies, CLIENTE_LOCAL.escala),
]);

// Cartel de opciones (Historia narrada): la pregunta final con A y B y la
// invitación a comentar. Lo pone el código, nunca la IA, y es la única
// excepción a "nada de texto grande" del reel ilustrado.
export type OpcionesCartel = { a: string; b: string };
export const CARTEL_LOCAL: Rect = { x: 40, y: 40, ancho: 820, alto: 1180 };
const ZONA_CARTEL: Rect = { x: 0, y: 0, ancho: 900, alto: 1260 };
// Escenas que solo pone el código (no se le ofrecen a la IA).
export const ESCENAS_SOLO_CODIGO = ["opciones"] as const;

export function unionRects(rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, ancho: Math.max(...rs.map((r) => r.x + r.ancho)) - x, alto: Math.max(...rs.map((r) => r.y + r.alto)) - y };
}

type DefinicionEscena = {
  // Isla del mundo donde vive la escena ("celular" para las pantallas).
  isla: IdIsla;
  // Qué hace cada acción y qué zona de la isla hay que mostrar.
  acciones: Record<string, { descripcion: string; foco: Rect }>;
};

export const ISLAS = {
  celular: { ancho: CELULAR_ISLA.ancho, alto: CELULAR_ISLA.alto },
  billetera: { ancho: 760, alto: 900 },
  multitud: { ancho: 2000, alto: 1200 },
  reloj_cliente: { ancho: 1000, alto: 1100 },
  grafica: { ancho: 640, alto: 680 },
  opciones: { ancho: 900, alto: 1260 },
} as const;
export type IdIsla = keyof typeof ISLAS;

export const CATALOGO = {
  feed: {
    isla: "celular",
    acciones: {
      micro: { descripcion: "el feed se desliza un poco (micro-acción neutra)", foco: ZONA_POST },
      aparece_anuncio: { descripcion: "el feed se detiene en un anuncio de la tienda", foco: ZONA_POST },
      lo_miran: { descripcion: "aparecen ojos mirando el anuncio", foco: ZONA_POST },
      pasa_de_largo: { descripcion: "el dedo sigue y el anuncio pasa de largo", foco: ZONA_POST },
      desliza: { descripcion: "el dedo desliza el feed a la siguiente publicación", foco: ZONA_POST },
      foto_apagada: { descripcion: "la foto del producto aparece oscura y sin color", foco: ZONA_POST },
      foto_se_aclara: { descripcion: "la foto del producto se vuelve luminosa y cálida", foco: ZONA_POST },
      vuelve: { descripcion: "el feed vuelve a la publicación anterior", foco: ZONA_POST },
      se_detiene: { descripcion: "el dedo toca la publicación y salta un corazón", foco: ZONA_POST },
    },
  },
  chat: {
    isla: "celular",
    acciones: {
      micro: { descripcion: "aparece \"escribiendo\" (micro-acción neutra)", foco: ZONA_CHAT },
      llega_mensaje: { descripcion: "llega un mensaje del cliente", foco: ZONA_CHAT },
      responde: { descripcion: "la tienda responde al instante (burbuja verde)", foco: ZONA_CHAT },
      se_vuelve_venta: { descripcion: "el último mensaje del cliente se convierte en una bolsa de compra", foco: ZONA_CHAT },
    },
  },
  publicacion: {
    isla: "celular",
    acciones: {
      micro: { descripcion: "la publicación se mueve un poco (micro-acción neutra)", foco: ZONA_PUBLICACION },
      aparece: { descripcion: "se abre una publicación PROPIA de la marca (su cuenta, sin \"Patrocinado\") con sus Me gusta", foco: ZONA_PUBLICACION },
      suben_likes: { descripcion: "los Me gusta de esa publicación propia suben y saltan corazones", foco: ZONA_PUBLICACION },
      toca_promocionar: { descripcion: "el dedo toca el botón Promocionar de la publicación propia", foco: ZONA_PUBLICACION },
    },
  },
  perfil: {
    isla: "celular",
    acciones: {
      micro: { descripcion: "el botón Seguir late (micro-acción neutra)", foco: ZONA_PERFIL },
      aparece: { descripcion: "se abre el perfil de la cuenta", foco: ZONA_PERFIL },
      toque_seguir: { descripcion: "el dedo toca Seguir y cambia a Siguiendo", foco: ZONA_PERFIL },
    },
  },
  billetera: {
    isla: "billetera",
    acciones: {
      micro: { descripcion: "la billetera se mece (micro-acción neutra)", foco: ZONA_BILLETERA },
      sale_moneda: { descripcion: "una moneda grande sale de la billetera y cae", foco: ZONA_BILLETERA },
      se_cierra: { descripcion: "la billetera se cierra: deja de salir dinero", foco: ZONA_BILLETERA },
      recibe_moneda: { descripcion: "una moneda llega a la billetera", foco: ZONA_BILLETERA },
      se_llena: { descripcion: "llueven monedas y la billetera se llena", foco: ZONA_BILLETERA },
    },
  },
  multitud: {
    isla: "multitud",
    acciones: {
      micro: { descripcion: "la gente se balancea (micro-acción neutra)", foco: ZONA_MULTITUD },
      foco_barre: { descripcion: "un foco de luz barre a toda la gente", foco: ZONA_MULTITUD },
      todos_tenues: { descripcion: "toda la gente queda tenue (hablarle a todos)", foco: ZONA_MULTITUD },
      se_iluminan: { descripcion: "se iluminan solo los que sí pueden comprar", foco: ZONA_ELEGIDOS },
      miran_arriba: { descripcion: "los elegidos levantan la mirada", foco: ZONA_ELEGIDOS },
    },
  },
  reloj_cliente: {
    isla: "reloj_cliente",
    acciones: {
      micro: { descripcion: "el cliente se mueve inquieto (micro-acción neutra)", foco: ZONA_RELOJ_CLIENTE },
      espera: { descripcion: "un cliente espera junto a un reloj", foco: ZONA_RELOJ_CLIENTE },
      reloj_acelera: { descripcion: "el reloj gira cada vez más rápido", foco: ZONA_RELOJ_CLIENTE },
      cliente_se_va: { descripcion: "el cliente se cansa y se va", foco: ZONA_RELOJ_CLIENTE },
    },
  },
  grafica: {
    isla: "grafica",
    acciones: {
      micro: { descripcion: "acercamiento corto de cámara (micro-acción neutra)", foco: GRAFICA_LOCAL },
      sube: { descripcion: "las barras y la línea suben", foco: GRAFICA_LOCAL },
    },
  },
  opciones: {
    isla: "opciones",
    acciones: {
      micro: { descripcion: "el cartel late (micro-acción neutra)", foco: ZONA_CARTEL },
      aparece: { descripcion: "aparece el cartel con las opciones A y B", foco: ZONA_CARTEL },
      comenta: { descripcion: "llega una burbuja de comentario", foco: ZONA_CARTEL },
      resalta_a: { descripcion: "se resalta la opción A", foco: ZONA_CARTEL },
      resalta_b: { descripcion: "se resalta la opción B", foco: ZONA_CARTEL },
    },
  },
} as const satisfies Record<string, DefinicionEscena>;

export type IdEscena = keyof typeof CATALOGO;

// Qué se ve en cada escena, dicho para el control de calidad por visión.
export const ESCENA_VISIBLE: Record<IdEscena, string> = {
  feed: "un celular grande con un feed de publicaciones (una publicación o anuncio con su foto)",
  chat: "un celular grande con un chat y burbujas de mensajes",
  perfil: "un celular grande con el perfil de una cuenta y el botón Seguir/Siguiendo",
  publicacion: "un celular grande con una publicación de la marca, su contador de Me gusta y el botón Promocionar",
  billetera: "una billetera grande (con monedas)",
  multitud: "una multitud de personas ilustradas",
  reloj_cliente: "un reloj grande junto a un cliente ilustrado",
  grafica: "una gráfica de barras con una línea que sube",
  opciones: "un cartel con dos opciones, A y B, y una burbuja de comentario",
};

// Micro-acción neutra (fase 2, arreglo de ritmo): la escena que está en
// pantalla hace un gesto chico y la cámara se acerca un poco, SIN cambiar
// de toma. El código la inserta para que nunca pasen más de 2,5 s sin
// cambio; no la elige la IA (no aparece en el prompt).
export const MICRO = "micro";
export type AccionDe<E extends IdEscena> = keyof (typeof CATALOGO)[E]["acciones"] & string;
export const ID_ESCENAS = Object.keys(CATALOGO) as IdEscena[];

export function definicionAccion(escena: IdEscena, accion: string): { descripcion: string; foco: Rect } | null {
  const acciones = CATALOGO[escena].acciones as Record<string, { descripcion: string; foco: Rect }>;
  return acciones[accion] ?? null;
}
