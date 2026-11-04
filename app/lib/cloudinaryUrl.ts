// Pide a Cloudinary una versión liviana para mostrar (no para descargar):
// formato automático (webp/avif cuando el navegador lo soporta), calidad
// automática, y un ancho máximo -- mismo truco de insertar la transformación
// justo después de "/upload/" que ya usan urlDescargaCloudinary y
// extraerFramesVideo. Pensada para banners/miniaturas del Inicio.
export function urlOptimizadaCloudinary(url: string, anchoMaximo: number): string {
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${anchoMaximo}/`);
}

// Fuerza que el navegador descargue el archivo en vez de reproducirlo/
// mostrarlo inline -- Cloudinary respeta el flag fl_attachment insertado
// en la URL de entrega. Funciona igual para /image/upload/ y
// /video/upload/, mismo patrón de URL en ambos resource types.
export function urlDescargaCloudinary(url: string): string {
  return url.replace("/upload/", "/upload/fl_attachment/");
}

// Genera 3 URLs de frames fijos (inicio/mitad/casi-final) a partir de la
// URL de un video de Cloudinary, para mandarle imágenes fijas a un modelo
// de visión (analizar un video completo no es viable/barato). Mismo truco
// de inserción después de "/upload/" que urlDescargaCloudinary, más
// cambiar la extensión final a .jpg -- así es como Cloudinary entrega un
// frame como imagen desde un recurso de video.
// so_##p = offset como porcentaje de la duración del video (documentado
// en https://cloudinary.com/documentation/transformation_reference_so_start_offset).
// so_90p en vez de so_100p para no pisar el borde exacto del final.
export function extraerFramesVideo(url: string): string[] {
  const conExtensionJpg = url.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, ".jpg$1");
  return ["so_0p", "so_50p", "so_90p"].map((offset) =>
    conExtensionJpg.replace("/upload/", `/upload/${offset}/`)
  );
}

// Portada fija para un video subido en "Subir el mío" (ver
// app/components/ElegirEstrategia.tsx) -- a diferencia de
// extraerFramesVideo (3 frames por porcentaje, para mandarle un video
// completo a un modelo de visión), esto es UNA sola miniatura en un
// segundo absoluto (so_1, no so_1p) para usar como poster del <video> en
// la tarjeta y como url_imagen del creativo. Mismo truco de inserción
// después de "/upload/" + cambiar la extensión a .jpg.
export function urlPortadaVideo(url: string): string {
  const conExtensionJpg = url.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, ".jpg$1");
  return conExtensionJpg.replace("/upload/", "/upload/so_1/");
}

// pistas_musicales (biblioteca de música de video/, ver docs/diseno/
// plan_video_anuncios_fase1.md sección 8) solo guarda public_id y
// cloudinary_name -- a diferencia de album_creativos, nunca guarda la
// URL completa, así que hay que armarla. El audio en Cloudinary se sube
// como resource_type "video" (no existe un tipo "audio" separado en su
// API, ver app/api/admin/musica/route.ts), y se fuerza ".mp3" para que
// la entrega sea consistente sin importar el formato original subido.
export function urlPistaMusical(cloudinaryName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudinaryName}/video/upload/${publicId}.mp3`;
}

// Recorte inteligente de Cloudinary (gratis en todos los planes, a
// diferencia de e_background_removal) para el tratamiento "completa" de
// video/ -- c_fill,g_auto deja que Cloudinary detecte el sujeto y
// recorte hacia él en vez de un recorte ciego al centro. ar_9:16 porque
// el video siempre es 9:16 (único formato de la Fase 1a).
export function urlRecorteVertical(url: string): string {
  return url.replace("/upload/", "/upload/c_fill,g_auto,ar_9:16/");
}
