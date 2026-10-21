// Bloques configurables del Inicio -- compartido entre el admin
// (/admin/inicio) y el propio Inicio (HomeInicio.tsx), para que los ids y
// el "siempre visible" de métricas/decisiones_pendientes tengan una sola
// fuente de verdad.
export type BloqueId =
  | "banners"
  | "estado_sistema"
  | "saludo"
  | "metricas"
  | "novedades"
  | "capacitaciones"
  | "decisiones_pendientes"
  | "actividad_reciente";

export type BloqueConfig = { id: string; visible: boolean };

export const BLOQUES_INICIO: { id: BloqueId; nombre: string; siempreVisible: boolean }[] = [
  { id: "banners", nombre: "Banners", siempreVisible: false },
  { id: "estado_sistema", nombre: "Quiubot trabajando en segundo plano", siempreVisible: false },
  { id: "saludo", nombre: "Saludo", siempreVisible: false },
  { id: "metricas", nombre: "Métricas", siempreVisible: true },
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
// agrega al final los que falten (ej. un bloque nuevo agregado al código
// después de que se guardó la config) con visible:true por defecto.
export function normalizarBloques(bloques: unknown): BloqueConfig[] {
  const idsConocidos = new Set(BLOQUES_INICIO.map((b) => b.id));
  const lista = Array.isArray(bloques) ? bloques : [];
  const limpios: BloqueConfig[] = lista.filter(
    (b): b is BloqueConfig =>
      !!b && typeof b === "object" && typeof (b as any).id === "string" && idsConocidos.has((b as any).id)
  );
  const presentes = new Set(limpios.map((b) => b.id));
  for (const b of BLOQUES_INICIO) {
    if (!presentes.has(b.id)) limpios.push({ id: b.id, visible: true });
  }
  return limpios;
}
