import type { TemaGuion } from "../../../tema";
import type { DisparosEscena } from "../plan";

export type PaletaIlustrada = { fondo: string; fondoProfundo: string; luz: string };

// Lo que el reel muestra de la tienda. Fase 1: valores fijos del
// prototipo; fase 3 los llena con los datos reales de la marca (nunca
// inventados: sin contadores, sin promesas que la marca no ofrece).
export type MarcaIlustrada = {
  nombreTienda: string; // nombre de la cuenta en el anuncio y el perfil
  colorMarca: string;
  colorSecundario: string;
  inicial: string;
  descripcionPerfil: string | null;
  chat: { cliente: string[]; respuesta: string };
};

export type PropsEscena = {
  frame: number;
  fps: number;
  d: DisparosEscena;
  paleta: PaletaIlustrada;
  tema: TemaGuion;
  marca: MarcaIlustrada;
  fotoUrl: string;
  // Solo pantallas del celular: cuadros en que cambia la pantalla.
  inicioFrase?: Record<string, number>;
};
