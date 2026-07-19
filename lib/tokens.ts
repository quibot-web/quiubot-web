import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "crypto";

// Genera el token que se manda por correo (el usuario nunca ve el hash).
export function generarToken(): string {
  return randomBytes(32).toString("hex");
}

// Solo se guarda este hash en la base de datos — si la base de datos se
// filtrara algún día, esos hashes no sirven para nada sin el token original.
export function hashearToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Comparación en tiempo constante, mismo patrón que /api/activar y el
// candado de admin — evita filtrar información por cuánto tarda la respuesta.
export function tokensCoinciden(hashGuardado: string, tokenRecibido: string): boolean {
  const hashRecibido = hashearToken(tokenRecibido);
  const bufA = Buffer.from(hashGuardado);
  const bufB = Buffer.from(hashRecibido);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}