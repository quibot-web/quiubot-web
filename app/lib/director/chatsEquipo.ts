// Registro fijo de los chats de la lista estilo WhatsApp (Fase 2,
// Commit 1) -- docs/diseno/director_lista_chats.html: Equipo (grupo,
// reemplaza /decisiones), Director, cada asistente con eventos reales
// (Analista, Creativo, Optimizador -- marca/estratega/publicador se
// quedan fuera, no tienen evento real asignado) y Soporte.
import type { AsistenteId } from "@/app/components/esferas/esferasShared";

export const CHATS_EQUIPO = ["equipo", "director", "analista", "creativo", "optimizador", "soporte"] as const;
export type ChatEquipoId = (typeof CHATS_EQUIPO)[number];

export const NOMBRE_CHAT: Record<ChatEquipoId, string> = {
  equipo: "Equipo",
  director: "Director",
  analista: "Analista",
  creativo: "Creativo",
  optimizador: "Optimizador",
  soporte: "Soporte",
};

// "equipo" no tiene una esfera propia -- en la lista se muestra como
// una pila de las esferas de sus miembros (Director/Analista/Creativo),
// no una sola identidad, así que queda fuera de este mapeo.
export const ESFERA_POR_CHAT: Partial<Record<ChatEquipoId, AsistenteId>> = {
  director: "director",
  analista: "analista",
  creativo: "creativo",
  optimizador: "optimizador",
  soporte: "soporte",
};

// Asistentes que sí tienen chat propio en la lista -- subconjunto de
// los 7 roles del Director (metas.ts) usado para filtrar mensajes de
// mensajes_equipo por chat individual.
export const ASISTENTES_CON_CHAT_PROPIO = ["analista", "creativo", "optimizador"] as const;
