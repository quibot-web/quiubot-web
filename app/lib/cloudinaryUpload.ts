import { createHash } from "crypto";

// Sube una imagen (base64 o data URI) al Cloudinary del propio cliente
// (ya tenemos sus credenciales) usando el endpoint de subida firmado --
// esta app nunca había subido directo a Cloudinary (las subidas reales
// de creativos las hace n8n), así que no había un helper para reusar.
// Firma según la documentación de Cloudinary: sha1 de los parámetros
// (menos file/api_key/signature/resource_type) ordenados alfabéticamente
// como "key=value&...", con el api_secret al final.
export async function subirFotoACloudinary(params: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  base64: string;
  folder: string;
}): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsAFirmar = `folder=${params.folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(paramsAFirmar + params.apiSecret).digest("hex");

  const form = new FormData();
  form.append("file", params.base64);
  form.append("api_key", params.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", params.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(params.cloudName)}/image/upload`, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message || "No se pudo subir la foto a Cloudinary.");
  }
  return data.secure_url as string;
}
