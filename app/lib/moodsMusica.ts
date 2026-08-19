// Valores exactos de pistas_musicales.mood (migracion_pistas_musicales.sql).
// Compartido entre el formulario de subida, el filtro de la lista y la
// validación del backend -- una sola fuente de verdad para los 5 moods.
export const MOODS_MUSICA = ["energetica", "inspiradora", "urgente", "confiable", "calida"] as const;

export type MoodMusica = (typeof MOODS_MUSICA)[number];

export const MOOD_LABEL: Record<MoodMusica, string> = {
  energetica: "Enérgica",
  inspiradora: "Inspiradora",
  urgente: "Urgente",
  confiable: "Confiable",
  calida: "Cálida",
};
