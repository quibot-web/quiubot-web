// Bloques configurables del Inicio -- compartido entre el admin
// (/admin/inicio) y el propio Inicio (HomeInicio.tsx), para que los ids y
// el "siempre visible" de métricas/decisiones_pendientes tengan una sola
// fuente de verdad.
export type BloqueId =
  | "banners"
  | "meta"
  | "estado_sistema"
  | "saludo"
  | "metricas"
  | "equipo"
  | "novedades"
  | "capacitaciones"
  | "decisiones_pendientes"
  | "actividad_reciente";

export type BloqueConfig = { id: string; visible: boolean };

// insertarDespuesDe solo se usa la primera vez que un bloque nuevo (que
// todavia no existe en una config_home ya guardada) se agrega de forma
// automatica -- ver normalizarBloques. No afecta el orden de bloques que
// el admin ya haya guardado o reordenado a mano.
export const BLOQUES_INICIO: { id: BloqueId; nombre: string; siempreVisible: boolean; insertarDespuesDe?: BloqueId }[] = [
  { id: "banners", nombre: "Banners", siempreVisible: false },
  { id: "meta", nombre: "Mi meta", siempreVisible: false, insertarDespuesDe: "banners" },
  { id: "estado_sistema", nombre: "Quiubot trabajando en segundo plano", siempreVisible: false },
  { id: "saludo", nombre: "Saludo", siempreVisible: false },
  { id: "metricas", nombre: "Métricas", siempreVisible: true },
  { id: "equipo", nombre: "Mi equipo", siempreVisible: false, insertarDespuesDe: "metricas" },
  { id: "novedades", nombre: "Actualizaciones", siempreVisible: false },
  { id: "capacitaciones", nombre: "Capacitaciones", siempreVisible: false },
  { id: "decisiones_pendientes", nombre: "Decisiones pendientes", siempreVisible: true },
  { id: "actividad_reciente", nombre: "Actividad reciente", siempreVisible: false },
];

export const BLOQUES_DEFAULT: BloqueConfig[] = BLOQUES_INICIO.map((b) => ({ id: b.id, visible: true }));

// Columna derecha fija en computador (métricas, actualizaciones,
// capacitaciones) -- el resto va a la izquierda. El orden dentro de cada
// columna sigue el de "bloques".
export const BLOQUES_COLUMNA_DERECHA = new Set<BloqueId>(["metricas", "novedades", "capacitaciones"]);

// Normaliza lo que venga de la base de datos: descarta ids que ya no
// existen en el código (para que un dato viejo nunca rompa el Inicio), y
// agrega los que falten (ej. un bloque nuevo agregado al código después
// de que se guardó la config) con visible:true por defecto -- justo
// después de su insertarDespuesDe si ese bloque ya está presente, o al
// final si no (primera vez que se normaliza, sin nada guardado todavía).
export function normalizarBloques(bloques: unknown): BloqueConfig[] {
  const idsConocidos = new Set(BLOQUES_INICIO.map((b) => b.id));
  const lista = Array.isArray(bloques) ? bloques : [];
  const limpios: BloqueConfig[] = lista.filter(
    (b): b is BloqueConfig =>
      !!b && typeof b === "object" && typeof (b as any).id === "string" && idsConocidos.has((b as any).id)
  );

  for (const b of BLOQUES_INICIO) {
    if (limpios.some((x) => x.id === b.id)) continue;
    const nuevo: BloqueConfig = { id: b.id, visible: true };
    const idxAncla = b.insertarDespuesDe ? limpios.findIndex((x) => x.id === b.insertarDespuesDe) : -1;
    if (idxAncla >= 0) {
      limpios.splice(idxAncla + 1, 0, nuevo);
    } else {
      limpios.push(nuevo);
    }
  }

  return limpios;
}
