import "server-only";

// Candado firmado (HMAC-SHA256) con expiracion para la segunda puerta del
// panel de administrador. Escrito con Web Crypto (crypto.subtle) en vez de
// el modulo "crypto" de Node, a proposito: este archivo lo importa tanto
// middleware.ts (que corre en el runtime Edge, sin el "crypto" de Node)
// como las rutas API normales (runtime Node) — Web Crypto funciona en los dos.

const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas

export const NOMBRE_COOKIE_ADMIN = "qb_admin_candado";

function base64UrlEncode(bytes: Uint8Array): string {
  let binario = "";
  bytes.forEach((b) => (binario += String.fromCharCode(b)));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const relleno = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + relleno;
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function obtenerClave(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Crea un candado firmado que expira en 8 horas. */
export async function firmarCandadoAdmin(secreto: string): Promise<string> {
  const exp = Date.now() + DURACION_MS;
  const payloadBytes = new TextEncoder().encode(JSON.stringify({ exp }));
  const clave = await obtenerClave(secreto);
  const firma = await crypto.subtle.sign("HMAC", clave, payloadBytes as BufferSource);
  return `${base64UrlEncode(payloadBytes)}.${base64UrlEncode(new Uint8Array(firma))}`;
}

/** Verifica firma + expiracion. Nunca confía en el payload sin antes validar la firma. */
export async function verificarCandadoAdmin(
  token: string | undefined | null,
  secreto: string
): Promise<boolean> {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 2) return false;

  try {
    const [payloadB64, firmaB64] = partes;
    const payloadBytes = base64UrlDecode(payloadB64);
    const firmaBytes = base64UrlDecode(firmaB64);
    const clave = await obtenerClave(secreto);

    const firmaValida = await crypto.subtle.verify(
      "HMAC",
      clave,
      firmaBytes as BufferSource,
      payloadBytes as BufferSource
    );
    if (!firmaValida) return false;

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}