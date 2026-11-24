// Registro de escenas de un plan (puro): las escenas fijas del catálogo
// (feed, chat, perfil, billetera, multitud, reloj, gráfica) más las
// composiciones del kit que trae el plan (visuales-v2). Todo el motor
// (recorrido, cámara, validación, control de calidad) pregunta acá qué isla
// es cada escena, qué acciones tiene y qué zona encuadra cada acción, así
// las composiciones del kit son islas como cualquier otra.
import { CATALOGO, ESCENA_VISIBLE, ISLAS, MICRO, unionRects, type IdEscena } from "./catalogo";
import type { Rect } from "./geometria";
import { ComposicionKitSchema, type ComposicionKitEntrada } from "../kit/catalogoKit";
import { accionesDeComposicion, descripcionVisible, focoDeAccionKit, rectPersonaje, ubicarComposicion, type ComposicionUbicada } from "../kit/composicion";

export type DefAccion = { descripcion: string; foco: Rect };
export type DefEscena = { isla: string; celular: boolean; acciones: Record<string, DefAccion>; visible: string };

export type Registro = {
  escena(id: string): DefEscena | null;
  tamIsla(isla: string): { ancho: number; alto: number } | null;
  // Foco de una acción en coordenadas de SU isla (con objetivo, si lo hay).
  foco(escena: string, accion: string, objetivo?: string): Rect | null;
  composicion(id: string): ComposicionUbicada | null;
  ids(): string[];
};

export function crearRegistro(composiciones: ComposicionKitEntrada[] = [], semilla = ""): Registro {
  const kit = new Map<string, { cu: ComposicionUbicada; def: DefEscena }>();
  for (const entrada of composiciones) {
    // Normaliza con el esquema (valores por defecto: plano, mira, pose...).
    const parseada = ComposicionKitSchema.safeParse(entrada);
    if (!parseada.success) continue; // el validador del plan ya lo reporta
    const c = parseada.data;
    const cu = ubicarComposicion(c, semilla);
    const acciones = accionesDeComposicion(cu);
    // Micro-acción neutra: la gente respira y la cámara se acerca un poco.
    const todos = cu.personajes.map((u) => rectPersonaje(u));
    acciones[MICRO] = { descripcion: "los personajes se mueven un poco (micro-acción neutra)", foco: todos.length ? unionRects(todos) : { x: 0, y: 0, ...cu.isla } };
    kit.set(c.id, { cu, def: { isla: c.id, celular: false, acciones, visible: descripcionVisible(cu) } });
  }
  const escena = (id: string): DefEscena | null => {
    const k = kit.get(id);
    if (k) return k.def;
    if (id in CATALOGO) {
      const e = CATALOGO[id as IdEscena];
      return { isla: e.isla, celular: e.isla === "celular", acciones: e.acciones as Record<string, DefAccion>, visible: ESCENA_VISIBLE[id as IdEscena] };
    }
    return null;
  };
  return {
    escena,
    tamIsla: (isla) => kit.get(isla)?.cu.isla ?? (isla in ISLAS ? ISLAS[isla as keyof typeof ISLAS] : null),
    foco: (id, accion, objetivo) => {
      const k = kit.get(id);
      if (k) return accion === MICRO ? k.def.acciones[MICRO].foco : focoDeAccionKit(k.cu, accion, objetivo);
      return escena(id)?.acciones[accion]?.foco ?? null;
    },
    composicion: (id) => kit.get(id)?.cu ?? null,
    ids: () => [...Object.keys(CATALOGO), ...kit.keys()],
  };
}

// Solo el catálogo fijo (planes sin composiciones y pruebas viejas).
export const REGISTRO_CATALOGO = crearRegistro();
