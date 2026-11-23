// De un guion guardado (con plan ilustrado) a las props del reel
// ilustrado: lo usan la cola de render y la vista previa de /contenido.
// Relativo, no "@/..." (mismo criterio que video/guion.schema.ts).
import type { Guion } from "../guion.schema";
import type { MediosResueltos } from "../escenas/tipos";
import type { TemaGuion } from "../tema";
import { idsFotosSinTexto } from "../estilos/estilos";
import type { MarcaIlustrada } from "./motor/escenas/tipos";
import type { PropsReelIlustrado } from "./ReelIlustrado";

// Marca a partir del tema (fase 2). Sin datos inventados: sin
// descripción en el perfil (null) y un chat que no promete nada.
// La fase 3 usa los datos reales de la marca.
export function marcaDesdeTema(tema: TemaGuion): MarcaIlustrada {
  const usuario = tema.instagramUsuario?.replace(/^@/, "").trim();
  const nombre = (usuario || tema.nombre_marca || "tu.tienda").slice(0, 22);
  return {
    nombreTienda: nombre,
    colorMarca: tema.color_primario,
    colorSecundario: tema.color_secundario,
    inicial: (tema.nombre_marca || nombre).trim().slice(0, 1).toUpperCase() || "T",
    descripcionPerfil: null,
    chat: { cliente: ["Hola", "¿Precio?", "¡Lo quiero!"], respuesta: "¡Hola! Ya te ayudo" },
  };
}

// La foto del producto: SOLO una foto de la pieza analizada y sin texto
// encima. Nunca una captura con texto como producto (QC de staging, 23
// nov 2026: Quiubot es un software y su álbum son capturas). Sin foto
// apta, undefined: el reel muestra una tarjeta de marca ilustrada (y en
// la fase 3, un producto ilustrado según el tipo de negocio).
export function fotoParaReelIlustrado(guion: Pick<Guion, "analisisPiezas">, medios: MediosResueltos | undefined): string | undefined {
  if (!medios) return undefined;
  const sinTexto = idsFotosSinTexto(medios, guion.analisisPiezas);
  return sinTexto.length > 0 ? medios[sinTexto[0]].url : undefined;
}

export function propsReelIlustradoDesdeGuion(guion: Guion, medios: MediosResueltos | undefined, pistaMusicaUrl: string | null): PropsReelIlustrado | null {
  if (!guion.ilustrado || !guion.tiemposRender || !guion.palabrasPorEscena || !guion.segmentosAudio) return null;
  return {
    tiempos: { tiemposRender: guion.tiemposRender, palabrasPorEscena: guion.palabrasPorEscena, segmentosAudio: guion.segmentosAudio },
    plan: guion.ilustrado,
    vozUrl: guion.vozUrl ?? null,
    fotoUrl: fotoParaReelIlustrado(guion, medios),
    tema: guion.tema,
    marca: marcaDesdeTema(guion.tema),
    pistaMusicaUrl,
    volumenMusica: guion.musica.volumen,
    ...(guion.serie ? { serie: guion.serie } : {}),
  };
}
