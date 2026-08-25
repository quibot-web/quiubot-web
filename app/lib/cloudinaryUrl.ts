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
