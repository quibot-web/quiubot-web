// Compartido entre /estrategia y /marca (ADN) -- antes vivía duplicado (o,
// en el caso de /marca, no existía en absoluto) en cada página.

const LADO_MAXIMO_IMAGEN = 1600;
const CALIDAD_JPEG = 0.85;
const PESO_MAXIMO_SIN_COMPRIMIR = 800 * 1024; // 800KB

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Redimensiona y comprime la imagen SOLO cuando hace falta -- fotos de
// celular modernas pueden pesar varios MB, y en base64 eso crece un 33%
// mas, lo cual puede chocar contra limites de tamano de body (Next.js,
// n8n) o de localStorage (usado para guardar el progreso del wizard) y
// terminar produciendo un base64 truncado/invalido en OpenAI. Pero si la
// imagen ya es liviana y de tamano razonable, se manda tal cual: convertir
// todo a JPEG siempre le quitaria la transparencia a un PNG (ej. un
// producto recortado con fondo transparente), y seria trabajo innecesario
// para algo que ya esta bien.
export function comprimirSiHaceFalta(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const yaEsLiviana = file.size <= PESO_MAXIMO_SIN_COMPRIMIR && img.width <= LADO_MAXIMO_IMAGEN && img.height <= LADO_MAXIMO_IMAGEN;
      if (yaEsLiviana) {
        URL.revokeObjectURL(url);
        fileToBase64(file).then(resolve).catch(reject);
        return;
      }
      let { width, height } = img;
      if (width > LADO_MAXIMO_IMAGEN || height > LADO_MAXIMO_IMAGEN) {
        const escala = LADO_MAXIMO_IMAGEN / Math.max(width, height);
        width = Math.round(width * escala);
        height = Math.round(height * escala);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", CALIDAD_JPEG));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer esa imagen"));
    };
    img.src = url;
  });
}

// Algunos navegadores/celulares mandan file.type vacío (sobre todo con
// HEIC) -- en ese caso se valida por extensión antes de descartar el
// archivo. Si el tipo SÍ viene, se confía en él (más confiable que el
// nombre del archivo).
const EXTENSIONES_IMAGEN = [".jpg", ".jpeg", ".png", ".webp", ".heic"];

export function esArchivoDeImagen(file: File): boolean {
  if (file.type) return file.type.startsWith("image/");
  const nombre = file.name.toLowerCase();
  return EXTENSIONES_IMAGEN.some((ext) => nombre.endsWith(ext));
}

// Más estricto que esArchivoDeImagen a propósito -- es solo para "Subir
// el mío" en /estrategia (reemplaza la imagen generada por IA de un
// anuncio puntual): JPG/PNG/WebP nada más (sin HEIC, que Meta tampoco
// acepta tal cual) y un mínimo de 600px por lado, porque por debajo de
// eso Meta la rechaza directamente o se ve borrosa en el feed. El resto
// de la app (fotos de producto) sigue usando esArchivoDeImagen, más
// permisivo, sin tocar.
const TIPOS_PERMITIDOS_SUBIDA = ["image/jpeg", "image/png", "image/webp"];
const LADO_MINIMO_SUBIDA = 600;

export async function validarImagenPropia(file: File): Promise<{ ok: true; base64: string } | { ok: false; error: string }> {
  if (!TIPOS_PERMITIDOS_SUBIDA.includes(file.type)) {
    return { ok: false, error: "Solo se aceptan imágenes JPG, PNG o WebP." };
  }

  const dimensiones = await new Promise<{ width: number; height: number } | null>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

  if (!dimensiones) {
    return { ok: false, error: "No se pudo leer esa imagen." };
  }
  if (dimensiones.width < LADO_MINIMO_SUBIDA || dimensiones.height < LADO_MINIMO_SUBIDA) {
    return { ok: false, error: `La imagen es muy pequeña (mínimo ${LADO_MINIMO_SUBIDA}×${LADO_MINIMO_SUBIDA}px).` };
  }

  try {
    const base64 = await comprimirSiHaceFalta(file);
    return { ok: true, base64 };
  } catch {
    return { ok: false, error: "No se pudo procesar esa imagen." };
  }
}
