// Recursos remotos del reel ilustrado (staging 23 nov 2026: "Failed to
// construct 'VideoFrame': VideoFrames can't be created from tainted
// sources"). El renderizador del navegador dibuja cada imagen en un
// canvas; una imagen de otro origen cargada sin CORS lo "contamina" y el
// render falla. Toda imagen remota (fotos del álbum en Cloudinary) se
// descarga UNA vez con CORS y se usa como blob: local; así tampoco se
// contaminan las variantes apagada/clara que se hornean en un canvas.
// Cloudinary responde Access-Control-Allow-Origin: * (verificado).

const locales = new Map<string, Promise<string | null>>();

export function esRemota(url: string, origen: string | null = typeof location === "undefined" ? null : location.origin): boolean {
  if (/^(blob:|data:)/.test(url)) return false;
  if (!/^https?:\/\//i.test(url)) return false; // relativa: mismo origen
  return origen === null || !url.startsWith(origen + "/");
}

// URL local (blob:) de un recurso remoto, descargado con CORS. Si no se
// puede (sin CORS, 404, red), null: quien llama decide el respaldo.
export function aUrlLocal(url: string): Promise<string | null> {
  if (!esRemota(url)) return Promise.resolve(url);
  let p = locales.get(url);
  if (!p) {
    p = fetch(url, { mode: "cors", credentials: "omit" })
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null);
    locales.set(url, p);
  }
  return p;
}
