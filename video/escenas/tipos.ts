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
}
