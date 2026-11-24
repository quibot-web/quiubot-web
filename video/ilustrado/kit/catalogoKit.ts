// Kit de escenas del reel ilustrado (etapa visuales-v2, tanda 1, 23 nov
// 2026). Listas CERRADAS: la IA solo compone con estos valores en JSON
// (composiciones del plan), nunca escribe código ni SVG. El kit crece por
// tandas: cada tanda suma valores acá y se aprueba con un video de muestra
// antes de que la IA pueda usarla.
//
// Puro: lo usan el dibujo, el motor, el validador y el control de calidad.
import { z } from "zod";

// ---------- Personajes ----------
export const TIPOS_PERSONAJE = ["profesora", "nino", "nina"] as const;
export type TipoPersonaje = (typeof TIPOS_PERSONAJE)[number];
export const NOMBRE_PERSONAJE: Record<TipoPersonaje, string> = { profesora: "una profesora", nino: "un niño", nina: "una niña" };

// "parado" es la pose base (sin acción). "ofrecer" (tender algo con la
// mano) no estaba en la lista de la tanda 1: la pide el prototipo (el
// niño que le trae dulces a la profesora).
export const POSES = ["parado", "senalar", "celebrar", "aplaudir", "ofrecer", "levantar_mano"] as const;
export type Pose = (typeof POSES)[number];
// "normal" es la expresión base.
export const EXPRESIONES = ["normal", "feliz", "triste", "sorprendido"] as const;
export type Expresion = (typeof EXPRESIONES)[number];

export const PIELES = { clara: "#F5D0B5", triguena: "#E2AF86", media: "#C98E62", morena: "#9A6440", oscura: "#6B4128" } as const;
export const PELOS = { negro: "#2A2220", castano: "#5B3A26", castano_claro: "#8A5A36", rubio: "#D9A949", pelirrojo: "#B5532A", canoso: "#B9B4AE" } as const;
export const PEINADOS = ["corto", "largo", "colitas", "mono", "rizado"] as const;
export const COLORES_ROPA = {
  azul: "#3F6FD8",
  rojo: "#D9473F",
  verde: "#3FA66B",
  amarillo: "#F2C230",
  morado: "#7A55C7",
  naranja: "#EE8A35",
  rosado: "#E86A9A",
  turquesa: "#2FB3B0",
  gris: "#7C8494",
  blanco: "#F2F0EA",
} as const;
export const ACCESORIOS = ["ninguno", "gafas"] as const;
export type Piel = keyof typeof PIELES;
export type ColorPelo = keyof typeof PELOS;
export type Peinado = (typeof PEINADOS)[number];
export type ColorRopa = keyof typeof COLORES_ROPA;
export type Accesorio = (typeof ACCESORIOS)[number];

// ---------- Lugares ----------
export const FONDOS = ["salon"] as const;
export type Fondo = (typeof FONDOS)[number];
export const NOMBRE_FONDO: Record<Fondo, string> = { salon: "un salón de clases" };
// Colores de pared que rotan entre reels (variedad, mismo estilo).
export const PAREDES = { crema: "#EFE3CC", menta: "#D4E8DA", celeste: "#D6E4F0", durazno: "#F2D9C4" } as const;
export type Pared = keyof typeof PAREDES;

// Dónde va cada cosa dentro del lugar (la IA elige la casilla, no píxeles).
export const POSICIONES = ["izquierda", "centro_izquierda", "centro", "centro_derecha", "derecha"] as const;
export type Posicion = (typeof POSICIONES)[number];
export const LUGARES_PARED = ["pared_izquierda", "pared_centro", "pared_derecha"] as const;
export const LUGARES_PISO = ["piso_izquierda", "piso_centro_izquierda", "piso_centro", "piso_centro_derecha", "piso_derecha"] as const;
export type LugarObjeto = (typeof LUGARES_PARED)[number] | (typeof LUGARES_PISO)[number];

// ---------- Objetos ----------
export const TIPOS_OBJETO = ["cartelera", "dibujo", "dulces", "pupitre"] as const;
export type TipoObjeto = (typeof TIPOS_OBJETO)[number];
export const NOMBRE_OBJETO: Record<TipoObjeto, string> = { cartelera: "una cartelera de corcho llena de dibujos con un solo espacio vacío", dibujo: "un dibujo infantil", dulces: "una bolsa de dulces", pupitre: "un pupitre con su silla" };
export const MOTIVOS_DIBUJO = ["sol_casa", "flor", "gato", "arcoiris", "arbol", "cohete", "pez", "corazon", "mariposa", "barco", "estrella", "perro"] as const;
export type MotivoDibujo = (typeof MOTIVOS_DIBUJO)[number];

// ---------- Verbos (acciones amarradas a palabras) ----------
// Una acción del kit se escribe "elemento.verbo" (ej. "profesora.senala").
export const VERBOS_PERSONAJE = {
  senala: { pose: "senalar", descripcion: "señala" },
  celebra: { pose: "celebrar", descripcion: "celebra con los brazos arriba" },
  aplaude: { pose: "aplaudir", descripcion: "aplaude" },
  ofrece: { pose: "ofrecer", descripcion: "tiende lo que tiene en la mano" },
  levanta_la_mano: { pose: "levantar_mano", descripcion: "levanta la mano" },
  quieto: { pose: "parado", descripcion: "se queda quieto" },
  feliz: { expresion: "feliz", descripcion: "sonríe feliz" },
  triste: { expresion: "triste", descripcion: "se pone triste" },
  sorprendido: { expresion: "sorprendido", descripcion: "se sorprende" },
} as const satisfies Record<string, { pose?: Pose; expresion?: Expresion; descripcion: string }>;
export type VerboPersonaje = keyof typeof VERBOS_PERSONAJE;

export const VERBOS_OBJETO: Record<TipoObjeto, Record<string, string>> = {
  cartelera: { aparece: "aparece la cartelera", destaca: "la cartelera late", destaca_hueco: "el único espacio libre de la cartelera late" },
  dibujo: { aparece: "aparece el dibujo", destaca: "el dibujo brilla y salta", va_al_hueco: "el dibujo vuela al espacio libre de la cartelera" },
  dulces: { aparece: "aparecen los dulces", destaca: "los dulces brillan" },
  pupitre: {},
};

// ---------- Composición (lo que escribe la IA) ----------
const IdElemento = z.string().regex(/^[a-z][a-z0-9_]{0,20}$/);
export const PersonajeKitSchema = z
  .object({
    id: IdElemento,
    tipo: z.enum(TIPOS_PERSONAJE),
    posicion: z.enum(POSICIONES),
    plano: z.enum(["frente", "fondo"]).default("frente"),
    mira: z.enum(["izquierda", "derecha"]).default("derecha"),
    pose: z.enum(POSES).default("parado"),
    expresion: z.enum(EXPRESIONES).default("normal"),
    // Opcionales: si faltan, salen de la semilla del reel (los personajes
    // varían entre reels, siempre en el mismo estilo).
    ropa: z.enum(Object.keys(COLORES_ROPA) as [ColorRopa, ...ColorRopa[]]).optional(),
    ropa2: z.enum(Object.keys(COLORES_ROPA) as [ColorRopa, ...ColorRopa[]]).optional(),
    piel: z.enum(Object.keys(PIELES) as [Piel, ...Piel[]]).optional(),
    pelo: z.enum(Object.keys(PELOS) as [ColorPelo, ...ColorPelo[]]).optional(),
    peinado: z.enum(PEINADOS).optional(),
    accesorio: z.enum(ACCESORIOS).optional(),
    // Sentado detrás de un pupitre de la composición (id del pupitre).
    sentado_en: IdElemento.optional(),
    // Hacia dónde mira cuando no pasa nada (id de otro elemento).
    mira_a: IdElemento.optional(),
  })
  .strict();
export const ObjetoKitSchema = z
  .object({
    id: IdElemento,
    tipo: z.enum(TIPOS_OBJETO),
    // En la pared o el piso, o en la mano de un personaje.
    lugar: z.enum([...LUGARES_PARED, ...LUGARES_PISO]).optional(),
    en_mano_de: IdElemento.optional(),
    motivo: z.enum(MOTIVOS_DIBUJO).optional(),
    // En el piso: adelante o atrás (filas con profundidad).
    plano: z.enum(["frente", "fondo"]).default("frente"),
    // false: no se ve hasta su acción "aparece".
    visible: z.boolean().default(true),
  })
  .strict()
  .refine((o) => (o.lugar ? 1 : 0) + (o.en_mano_de ? 1 : 0) === 1, { message: "cada objeto va en un lugar o en la mano de un personaje (uno de los dos)" });
export const ComposicionKitSchema = z
  .object({
    id: z.string().regex(/^k_[a-z0-9_]{1,24}$/),
    fondo: z.enum(FONDOS),
    pared: z.enum(Object.keys(PAREDES) as [Pared, ...Pared[]]).optional(),
    personajes: z.array(PersonajeKitSchema).max(5),
    objetos: z.array(ObjetoKitSchema).max(8),
  })
  .strict();
export type PersonajeKit = z.output<typeof PersonajeKitSchema>;
export type ObjetoKit = z.output<typeof ObjetoKitSchema>;
export type ComposicionKit = z.output<typeof ComposicionKitSchema>;
export type ComposicionKitEntrada = z.input<typeof ComposicionKitSchema>;

export function esIdComposicion(escena: string): boolean {
  return /^k_[a-z0-9_]{1,24}$/.test(escena);
}
