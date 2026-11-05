// Registro fijo de los chats de la lista estilo WhatsApp
// (docs/diseno/director_lista_chats.html): Equipo (grupo, reemplaza
// /decisiones), Director, los 6 asistentes reales (todos, no solo los
// que tienen un evento automático materializado -- Marca/Estratega/
// Publicador tienen su propio trabajo real vía propuestas/trabajos_ia,
// aunque no generen un reporte diario) y Soporte.
import type { AsistenteId } from "@/app/components/esferas/esferasShared";

export const CHATS_EQUIPO = ["equipo", "director", "marca", "estratega", "creativo", "publicador", "analista", "optimizador", "soporte"] as const;
export type ChatEquipoId = (typeof CHATS_EQUIPO)[number];

export const NOMBRE_CHAT: Record<ChatEquipoId, string> = {
  equipo: "Equipo",
  director: "Director",
  marca: "Marca",
  estratega: "Estratega",
  creativo: "Creativo",
  publicador: "Publicador",
  analista: "Analista",
  optimizador: "Optimizador",
  soporte: "Soporte",
};

// "equipo" no tiene una esfera propia -- en la lista se muestra como
// una pila de las esferas de sus miembros (Director/Analista/Creativo),
// no una sola identidad, así que queda fuera de este mapeo.
export const ESFERA_POR_CHAT: Partial<Record<ChatEquipoId, AsistenteId>> = {
  director: "director",
  marca: "marca",
  estratega: "estratega",
  creativo: "creativo",
  publicador: "publicador",
  analista: "analista",
  optimizador: "optimizador",
  soporte: "soporte",
};

// Los 6 asistentes reales (todos los roles del Director salvo él
// mismo) -- cada uno con su propio chat de solo lectura en la sección
// "Asistentes" desplegable de la lista.
export const ASISTENTES_CON_CHAT_PROPIO = ["marca", "estratega", "creativo", "publicador", "analista", "optimizador"] as const;
