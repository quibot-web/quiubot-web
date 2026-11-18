// Rótulo de cada escena en el editor de /contenido/[id] (18 nov 2026):
// antes mostraba escena.tipo, que en el reel con voz es casi siempre
// "gancho_texto" (el tipo de escena del pipeline de siempre) y no dice
// nada. Ahora: el BLOQUE real (gancho, consejo 1/2/3, cierre, CTA) y el
// visual que usa.
import type { Guion } from "@/video/guion.schema";

const NOMBRE_BLOQUE: Record<string, string> = {
  gancho: "Gancho",
  valor: "Consejo",
  marca: "Cierre",
  cta: "CTA",
  producto: "Producto",
  beneficio: "Beneficio",
  objecion: "Objeción",
  problema: "Problema",
  oferta: "Oferta",
};

const NOMBRE_VISUAL: Record<string, string> = {
  celular_chat: "celular con mensajes",
  cursor_clic: "botón con clic",
  boton_estado: "botón que cambia",
  contador: "contador",
  anuncio_boton: "tarjeta a la que le falta algo",
  conexion_whatsapp: "conexión al chat",
  respuesta_lenta: "respuesta lenta / rápida",
  comparacion: "comparación así no / así sí",
  icono_palabra: "ícono + palabra grande",
  checklist: "checklist que se completa",
  comparacion_foto: "foto mal / foto bien",
};

export function rotuloEscena(escenas: Guion["escenas"], indice: number): { bloque: string; visual: string | null } {
  const escena = escenas[indice];
  const base = NOMBRE_BLOQUE[escena.bloque] ?? escena.bloque;
  const repetidos = escenas.filter((e) => e.bloque === escena.bloque);
  const bloque = repetidos.length > 1 ? `${base} ${repetidos.indexOf(escena) + 1}` : base;
  const visual = escena.visual ? (NOMBRE_VISUAL[escena.visual.tipo] ?? escena.visual.tipo) : null;
  return { bloque, visual };
}
