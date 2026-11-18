// Sistema de estilos visuales de los reels con voz (paso 1, 18 nov 2026
// -- plan aprobado por Juan José, ver docs en la memoria del proyecto).
// Los reels se veían todos iguales: mismo fondo morado, misma tarjeta
// blanca en la misma posición. Un ESTILO cambia el fondo, la cámara y el
// tratamiento de los visuales; un LAYOUT decide cómo se presenta cada
// escena. Los dos los elige el CÓDIGO (nunca la IA) y quedan guardados en
// el guion (guion.estilo) para que O2 pueda medir qué funciona.
//
// Archivo puro (sin React): lo usan el schema, la generación y los tests.
import { z } from "zod";
import { contrasteHex, mezclarColoresHex } from "../tema";

// Paso 1: solo "noche". "color_pleno" y "foto" llegan en el paso 2.
export const ESTILOS_VISUALES = ["noche"] as const;
export type EstiloVisualId = (typeof ESTILOS_VISUALES)[number];
// Sube cuando cambie cómo se ve un estilo, para que O2 no mezcle
// métricas de dos versiones distintas del mismo estilo.
export const VERSION_ESTILOS = 1;

export const LAYOUTS_ESCENA = ["palabra_gigante", "objeto_protagonista", "tarjeta_flotante"] as const;
export type LayoutEscena = (typeof LAYOUTS_ESCENA)[number];

export const EstiloGuionSchema = z.object({
  id: z.enum(ESTILOS_VISUALES),
  version: z.number().int().min(1),
  // escena_id -> layout
  layouts: z.record(z.string(), z.enum(LAYOUTS_ESCENA)),
});
export type EstiloGuion = z.infer<typeof EstiloGuionSchema>;

// Visuales que se pueden dibujar SIN tarjeta, grandes y directo sobre el
// fondo. Los demás son maquetas de interfaz (celular, anuncio, chat,
// botones): su tarjeta ES el objeto, así que van como tarjeta flotante.
export const VISUALES_PROTAGONISTA = ["icono_palabra", "contador", "checklist", "comparacion", "comparacion_foto"] as const;
const PROTAGONISTA = new Set<string>(VISUALES_PROTAGONISTA);

type EscenaParaEstilo = { id: string; bloque: string; tipo: string; params?: unknown; visual?: { tipo: string } };

// Cómo se dibuja un visual cuando no es el gancho con palabra gigante
// (también el visual que entra DESPUÉS de la palabra gigante).
export function layoutDelVisual(tipoVisual: string | undefined): LayoutEscena {
  return tipoVisual && PROTAGONISTA.has(tipoVisual) ? "objeto_protagonista" : "tarjeta_flotante";
}

export function layoutDeEscena(escena: EscenaParaEstilo): LayoutEscena {
  if (escena.bloque === "gancho" && escena.tipo === "gancho_texto") return "palabra_gigante";
  return layoutDelVisual(escena.visual?.tipo);
}

// Paso 1: un solo estilo implementado, así que toda pieza nueva sale en
// "noche". La rotación (el menos usado en las últimas 6, nunca igual a
// la anterior) llega en el paso 3, cuando haya dos estilos.
export function asignarEstilo(escenas: EscenaParaEstilo[]): EstiloGuion {
  return {
    id: "noche",
    version: VERSION_ESTILOS,
    layouts: Object.fromEntries(escenas.map((e) => [e.id, layoutDeEscena(e)])),
  };
}

// Paleta del estilo Noche, derivada del ADN: fondo casi negro teñido del
// primario, luz del secundario, textos claros. Alerta/éxito en versión
// clara (los de siempre son para fondo blanco y aquí no contrastan).
export const COLOR_ALERTA_NOCHE = "#FF7A59";
export const COLOR_EXITO_NOCHE = "#4ADE80";
const NEGRO_NOCHE = "#05050A";

export function paletaNoche(colores: { color_primario: string; color_secundario: string }) {
  const fondo = mezclarColoresHex(colores.color_primario, NEGRO_NOCHE, 0.84);
  // La luz es el color de marca más claro de los dos (el que se ve sobre
  // el fondo oscuro); si los dos son oscuros, un tono aclarado del primario.
  const [masClaro] = [colores.color_secundario, colores.color_primario].sort((a, b) => contrasteHex(b, fondo) - contrasteHex(a, fondo));
  const luz = contrasteHex(masClaro, fondo) >= 3 ? masClaro : mezclarColoresHex(colores.color_primario, "#FFFFFF", 0.55);
  return {
    fondo,
    fondoProfundo: mezclarColoresHex(fondo, "#000000", 0.5),
    luz,
    texto: "#FFFFFF",
    textoSuave: "#C9C9D6",
    alerta: COLOR_ALERTA_NOCHE,
    exito: COLOR_EXITO_NOCHE,
    superficie: mezclarColoresHex(fondo, "#FFFFFF", 0.08),
  };
}
export type PaletaNoche = ReturnType<typeof paletaNoche>;
