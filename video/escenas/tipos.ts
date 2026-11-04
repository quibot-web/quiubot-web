// Relativo, no "@/..." -- ver el comentario en video/guion.schema.ts.
import type { AnalisisPieza } from "../../app/lib/analisisPieza";
import type { Escena } from "../guion.schema";
import type { TemaGuion } from "../tema";

export type EscenaDe<T extends Escena["tipo"]> = Extract<Escena, { tipo: T }>;

// {media_id: {url, tipo}} -- se guarda el tipo explícito (igual que la
// columna album_creativos.tipo) en vez de adivinarlo por la extensión de
// la URL de Cloudinary, que es frágil.
export type MediaResuelto = { url: string; tipo: "imagen" | "video" };
export type MediosResueltos = Record<string, MediaResuelto>;

export interface PropsEscena<T extends Escena["tipo"]> {
  escena: EscenaDe<T>;
  tema: TemaGuion;
  medios: MediosResueltos;
  // guion.analisisPiezas, pasado tal cual -- solo lo usan las escenas
  // con media (ProductoHero, GanchoTexto) para el sesgo del zoom hacia
  // recuadro_producto; las demás lo reciben pero lo ignoran.
  analisisPiezas?: Record<string, AnalisisPieza>;
}

// Compartido por ListaNumerada.tsx (el dueño del conteo) y
// capas/Bucle.tsx (que necesita saber exactamente el mismo cuadro por
// ítem para que su "X/Y" -- cuando indicador es "contador" -- coincida
// con el ítem que de verdad está en pantalla, en vez de recalcularlo
// con otra fórmula y desincronizarse.
export function cuadrosPorItemListaNumerada(duracionS: number, fps: number, totalItems: number): number {
  return Math.max(8, Math.floor((duracionS * fps) / totalItems));
}
