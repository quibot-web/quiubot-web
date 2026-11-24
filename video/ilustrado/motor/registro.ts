// Registro de escenas de un plan (puro): las escenas fijas del catálogo
// (feed, chat, perfil, billetera, multitud, reloj, gráfica) más las
// composiciones del kit que trae el plan (visuales-v2). Todo el motor
// (recorrido, cámara, validación, control de calidad) pregunta acá qué isla
// es cada escena, qué acciones tiene y qué zona encuadra cada acción, así
// las composiciones del kit son islas como cualquier otra.
import { CATALOGO, ESCENA_VISIBLE, ISLAS, MICRO, unionRects, type IdEscena } from "./catalogo";
import type { Rect } from "./geometria";
import { ComposicionKitSchema, type ComposicionKitEntrada } from "../kit/catalogoKit";
import { completarAmbiente } from "../kit/ambiente";
import type { Variedad } from "../kit/variedad";
import { planoLimpio } from "./camara";
import { caminoDe, accionesDeComposicion, descripcionVisible, focoDeAccionKit, focoReducidoKit, rectPersonaje, ubicarComposicion, type ComposicionUbicada } from "../kit/composicion";

export type DefAccion = { descripcion: string; foco: Rect };
export type DefEscena = { isla: string; celular: boolean; acciones: Record<string, DefAccion>; visible: string };

export type Registro = {
  escena(id: string): DefEscena | null;
  tamIsla(isla: string): { ancho: number; alto: number } | null;
  // Foco de una acción en coordenadas de SU isla (con objetivo, si lo hay).
  foco(escena: string, accion: string, objetivo?: string): Rect | null;
  composicion(id: string): ComposicionUbicada | null;
  // Kit: foco más chico si el de la acción no cabe (ver focoReducidoKit).
  focoReducido(escena: string, accion: string, objetivo?: string): Rect[];
  ids(): string[];
};

// variedad: pared y paleta de ropa del reel (variedad entre reels).
// caminantes: por composición, quiénes entran o se van en el plan (la
// cámara los cuida en todo su recorrido); ver caminantesDePlan.
export function crearRegistro(composiciones: ComposicionKitEntrada[] = [], semilla = "", opciones: { ambiente?: boolean; variedad?: Partial<Variedad>; caminantes?: Record<string, string[]> } = {}): Registro {
  const kit = new Map<string, { cu: ComposicionUbicada; def: DefEscena }>();
  const aspectos = new Map<string, ComposicionUbicada["personajes"][number]["aspecto"]>();
  for (const entrada of composiciones) {
    // Normaliza con el esquema (valores por defecto: plano, mira, pose...).
    const parseada = ComposicionKitSchema.safeParse(entrada);
    if (!parseada.success) continue; // el validador del plan ya lo reporta
    // Relleno mínimo de ambiente (extras al fondo) si la IA puso pocos.
    // Un extra nunca le quita a la cartelera su plano limpio.
    const cartelera = parseada.data.objetos.find((o) => o.tipo === "cartelera");
    const limpia = (x: typeof parseada.data) => !cartelera || planoLimpio(x.id, `${cartelera.id}.destaca`, undefined, crearRegistro([x], semilla, { ambiente: false })).ok;
    const c = opciones.ambiente === false ? parseada.data : completarAmbiente(parseada.data, semilla, limpia(parseada.data) ? limpia : () => true);
    const cu = ubicarComposicion(c, semilla, opciones.variedad);
    // La misma persona (mismo id) en otra composición se ve igual.
    for (const u of cu.personajes) {
      const antes = aspectos.get(u.per.id);
      if (antes && antes.tipo === u.aspecto.tipo) u.aspecto = antes;
      else aspectos.set(u.per.id, u.aspecto);
    }
    for (const u of cu.personajes) if (opciones.caminantes?.[c.id]?.includes(u.per.id)) u.caminoDx = caminoDe(u, c.fondo);
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
    focoReducido: (id, accion, objetivo) => {
      const k = kit.get(id);
      return k ? focoReducidoKit(k.cu, accion, objetivo) : [];
    },
    ids: () => [...Object.keys(CATALOGO), ...kit.keys()],
  };
}

// Solo el catálogo fijo (planes sin composiciones y pruebas viejas).
export const REGISTRO_CATALOGO = crearRegistro();

// Quiénes entran o se van, por composición (para crearRegistro).
export function caminantesDePlan(plan: { frases: { acciones: { escena: string; accion: string }[] }[] }): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  for (const a of plan.frases.flatMap((f) => f.acciones)) {
    const [id, verbo] = a.accion.split(".");
    if (verbo !== "entra" && verbo !== "se_va") continue;
    const lista = (res[a.escena] ??= []);
    if (!lista.includes(id)) lista.push(id);
  }
  return res;
}
