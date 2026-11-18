// Sistema de estilos visuales de los reels con voz (18 nov 2026 -- plan
// aprobado por Juan José; ver la memoria del proyecto). Los reels se
// veían todos iguales: mismo fondo morado, misma tarjeta blanca en la
// misma posición. Un ESTILO cambia el fondo, la cámara y los colores de
// TODOS los visuales; un LAYOUT decide cómo se presenta cada escena. Los
// dos los elige el CÓDIGO (nunca la IA) y quedan guardados en el guion
// (guion.estilo) para que O2 pueda medir qué funciona.
//
// Archivo puro (sin React): lo usan el schema, la generación y los tests.
import { z } from "zod";
import { colorTextoSobre, contrasteHex, mezclarColoresHex, type TemaGuion } from "../tema";
import { COLOR_ALERTA_BLOQUE, COLOR_EXITO_BLOQUE } from "../visuales/acento";

// Paso 1: noche. Paso 2: color_pleno y foto ("foto" solo si la pieza
// tiene fotos). La rotación automática llega en el paso 3.
export const ESTILOS_VISUALES = ["noche", "color_pleno", "foto"] as const;
export type EstiloVisualId = (typeof ESTILOS_VISUALES)[number];
// Sube cuando cambie cómo se ve un estilo, para que O2 no mezcle
// métricas de dos versiones distintas. v2: tarjetas con los colores del
// estilo, objeto centrado, texto gigante corto.
export const VERSION_ESTILOS = 2;

export const LAYOUTS_ESCENA = ["palabra_gigante", "objeto_protagonista", "tarjeta_flotante", "pantalla_dividida", "golpe_de_dato", "foto_borde_a_borde"] as const;
export type LayoutEscena = (typeof LAYOUTS_ESCENA)[number];

export const EstiloGuionSchema = z.object({
  id: z.enum(ESTILOS_VISUALES),
  version: z.number().int().min(1),
  // escena_id -> layout
  layouts: z.record(z.string(), z.enum(LAYOUTS_ESCENA)),
});
export type EstiloGuion = z.infer<typeof EstiloGuionSchema>;

// Visuales que se pueden dibujar como objeto grande, sin tarjeta. Los
// demás son maquetas de interfaz (celular, anuncio, chat, botones): su
// tarjeta ES el objeto, así que van como tarjeta flotante (con los
// colores del estilo).
export const VISUALES_PROTAGONISTA = ["icono_palabra", "contador", "checklist", "comparacion", "comparacion_foto"] as const;
const PROTAGONISTA = new Set<string>(VISUALES_PROTAGONISTA);

type EscenaParaEstilo = { id: string; bloque: string; tipo: string; visual?: { tipo: string } };

// Cómo se dibuja un visual en cada estilo (también el visual que entra
// DESPUÉS de la palabra gigante del gancho).
export function layoutDelVisual(tipoVisual: string | undefined, estilo: EstiloVisualId = "noche"): LayoutEscena {
  if (!tipoVisual || !PROTAGONISTA.has(tipoVisual)) return "tarjeta_flotante";
  if (estilo === "color_pleno") {
    if (tipoVisual === "contador") return "golpe_de_dato";
    if (tipoVisual === "comparacion" || tipoVisual === "comparacion_foto") return "pantalla_dividida";
  }
  if (estilo === "foto") {
    if (tipoVisual === "comparacion_foto") return "foto_borde_a_borde";
    if (tipoVisual === "comparacion") return "pantalla_dividida";
  }
  return "objeto_protagonista";
}

export function layoutDeEscena(escena: EscenaParaEstilo, estilo: EstiloVisualId = "noche"): LayoutEscena {
  if (escena.bloque === "gancho" && escena.tipo === "gancho_texto") return "palabra_gigante";
  return layoutDelVisual(escena.visual?.tipo, estilo);
}

// Estilos que admite una pieza: "foto" solo si tiene al menos una foto
// (con Noche + Foto, una marca sin fotos se quedaría sin rotación --
// decisión de Juan José: los iniciales son Noche y Color pleno).
export function estilosDisponibles(tieneFotos: boolean): EstiloVisualId[] {
  return tieneFotos ? ["noche", "color_pleno", "foto"] : ["noche", "color_pleno"];
}

// Paso 1-2: la generación sigue asignando "noche" (la rotación entre
// estilos llega en el paso 3). El estilo se puede pedir explícito (mp4 de
// revisión); "foto" sin fotos cae a "noche".
export function asignarEstilo(escenas: EscenaParaEstilo[], estilo: EstiloVisualId = "noche", opciones: { tieneFotos?: boolean } = {}): EstiloGuion {
  const id: EstiloVisualId = estilo === "foto" && !opciones.tieneFotos ? "noche" : estilo;
  return {
    id,
    version: VERSION_ESTILOS,
    layouts: Object.fromEntries(escenas.map((e) => [e.id, layoutDeEscena(e, id)])),
  };
}

// ---------------------------------------------------------------------
// Colores por estilo. Todo visual toma sus colores de acá (nunca fijos
// del estilo de siempre): los objetos protagonistas de "paleta" y las
// maquetas de interfaz de "tarjetas" (contexto en superficie.tsx).
// ---------------------------------------------------------------------

// Colores de las maquetas de interfaz (anuncio, conexión, respuesta,
// celular). CLÁSICA = los de siempre (reels sin estilo).
export type SuperficieTarjeta = {
  tarjeta: string; // fondo de la tarjeta / pantalla
  marco: string; // marco del teléfono
  texto: string;
  textoSuave: string;
  burbuja: string; // burbuja de mensaje recibido
  textoBurbuja: string;
  separador: string;
  // Fondo (CSS) de la cabecera del anuncio/origen -- antes el degradado
  // primario->secundario, que en Noche desentonaba (lila claro).
  // null = el degradado propio de cada componente (estilo de siempre).
  cabecera: ((tema: { color_primario: string; color_secundario: string }) => string) | null;
  borde: string | null; // borde de marca alrededor de la tarjeta
  sombra: string; // sombra de la tarjeta (box-shadow)
  alerta: string; // estado "problema" sobre la tarjeta
};

export const SUPERFICIE_CLASICA: SuperficieTarjeta = {
  tarjeta: "#ffffff",
  marco: "#0a0a0a",
  texto: "#111111",
  textoSuave: "#444444",
  burbuja: "#f0f0f0",
  textoBurbuja: "#111111",
  separador: "#eeeeee",
  cabecera: null,
  borde: null,
  sombra: "0 30px 80px rgba(0,0,0,0.5)",
  alerta: "#E8460B",
};

export type PaletaEstilo = {
  id: EstiloVisualId;
  fondo: string; // color de fondo base del estilo (Color pleno: el de la escena 0)
  fondoProfundo: string;
  luz: string; // acento de marca (anillos, palabra clave, títulos)
  texto: string;
  textoSuave: string;
  alerta: string;
  exito: string;
  superficie: string; // franjas/círculos detrás de un objeto protagonista
  // Color pleno: los objetos van sobre una placa (fondo de color vivo
  // detrás); Noche/Foto: directo sobre el fondo oscuro.
  placa: { fondo: string; borde: string; sombra: string } | null;
  tarjetas: SuperficieTarjeta;
};

export const COLOR_ALERTA_NOCHE = "#FF7A59";
export const COLOR_EXITO_NOCHE = "#4ADE80";
const NEGRO_NOCHE = "#05050A";
const TINTA = "#141414";

function paletaOscura(id: "noche" | "foto", colores: { color_primario: string; color_secundario: string }): PaletaEstilo {
  const fondo = mezclarColoresHex(colores.color_primario, NEGRO_NOCHE, 0.84);
  // La luz es el color de marca más claro de los dos (el que se ve sobre
  // el fondo oscuro); si los dos son oscuros, un tono aclarado del primario.
  const [masClaro] = [colores.color_secundario, colores.color_primario].sort((a, b) => contrasteHex(b, fondo) - contrasteHex(a, fondo));
  const luz = contrasteHex(masClaro, fondo) >= 3 ? masClaro : mezclarColoresHex(colores.color_primario, "#FFFFFF", 0.55);
  const superficie = mezclarColoresHex(fondo, "#FFFFFF", 0.08);
  return {
    id,
    fondo,
    fondoProfundo: mezclarColoresHex(fondo, "#000000", 0.5),
    luz,
    texto: "#FFFFFF",
    textoSuave: "#C9C9D6",
    alerta: COLOR_ALERTA_NOCHE,
    exito: COLOR_EXITO_NOCHE,
    superficie,
    placa: null,
    tarjetas: {
      tarjeta: superficie,
      marco: mezclarColoresHex(fondo, "#000000", 0.6),
      texto: "#FFFFFF",
      textoSuave: "#C9C9D6",
      burbuja: mezclarColoresHex(fondo, "#FFFFFF", 0.16),
      textoBurbuja: "#FFFFFF",
      separador: mezclarColoresHex(fondo, "#FFFFFF", 0.14),
      cabecera: () => `linear-gradient(145deg, ${mezclarColoresHex(luz, fondo, 0.55)}, ${mezclarColoresHex(luz, fondo, 0.8)})`,
      borde: luz,
      sombra: `0 0 50px ${mezclarColoresHex(luz, fondo, 0.5)}`,
      alerta: COLOR_ALERTA_NOCHE,
    },
  };
}

// Fondos de Color pleno, uno por escena: primario, secundario y un tono
// derivado, siempre ajustados para que el texto (blanco o tinta) llegue a
// 4,5:1.
export function fondoLegible(color: string): string {
  for (let t = 0; t <= 1; t += 0.05) {
    for (const hacia of ["#000000", "#FFFFFF"]) {
      const c = mezclarColoresHex(color, hacia, t);
      if (contrasteHex(colorTextoSobre(c), c) >= 4.5) return c;
    }
  }
  return "#000000";
}

export function fondosColorPleno(colores: { color_primario: string; color_secundario: string }): string[] {
  return [colores.color_primario, colores.color_secundario, mezclarColoresHex(colores.color_primario, "#000000", 0.45), mezclarColoresHex(colores.color_primario, colores.color_secundario, 0.5)].map(fondoLegible);
}

function paletaColorPleno(tema: { color_primario: string; color_secundario: string }): PaletaEstilo {
  const [fondo] = fondosColorPleno(tema);
  // Acento legible sobre la placa blanca: el color de marca con más
  // contraste contra blanco (o tinta si ninguno llega a 3:1).
  const [masOscuro] = [tema.color_primario, tema.color_secundario].sort((a, b) => contrasteHex(b, "#FFFFFF") - contrasteHex(a, "#FFFFFF"));
  const luz = contrasteHex(masOscuro, "#FFFFFF") >= 3 ? masOscuro : TINTA;
  return {
    id: "color_pleno",
    fondo,
    fondoProfundo: mezclarColoresHex(fondo, "#000000", 0.3),
    luz,
    texto: TINTA,
    textoSuave: "#4A4A4A",
    alerta: COLOR_ALERTA_BLOQUE,
    exito: COLOR_EXITO_BLOQUE,
    superficie: "#FFFFFF",
    placa: { fondo: "#FFFFFF", borde: TINTA, sombra: `14px 14px 0 ${TINTA}` },
    tarjetas: {
      ...SUPERFICIE_CLASICA,
      borde: TINTA,
      sombra: `14px 14px 0 ${TINTA}`,
    },
  };
}

export function paletaDeEstilo(id: EstiloVisualId, tema: Pick<TemaGuion, "color_primario" | "color_secundario">): PaletaEstilo {
  if (id === "color_pleno") return paletaColorPleno(tema);
  return paletaOscura(id, tema);
}

// Compatibilidad con el paso 1 (y sus tests).
export function paletaNoche(colores: { color_primario: string; color_secundario: string }): PaletaEstilo {
  return paletaOscura("noche", colores);
}
export type PaletaNoche = PaletaEstilo;
