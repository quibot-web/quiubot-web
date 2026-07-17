import "server-only"
import crypto from "crypto"

const ALGORITMO = "aes-256-gcm"

function obtenerClave(): Buffer {
  const clave = process.env.ENCRYPTION_KEY
  if (!clave) {
    throw new Error("Falta configurar ENCRYPTION_KEY en las variables de entorno del servidor.")
  }
  const buffer = Buffer.from(clave, "base64")
  if (buffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe decodificar a exactamente 32 bytes en base64.")
  }
  return buffer
}

/** Cifra un texto plano. Devuelve "iv:authTag:datosCifrados", todo en base64. */
export function encriptar(texto: string): string {
  const clave = obtenerClave()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITMO, clave, iv)
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("base64"), authTag.toString("base64"), cifrado.toString("base64")].join(":")
}

/** Descifra un texto generado por encriptar(). */
export function desencriptar(textoCifrado: string): string {
  const clave = obtenerClave()
  const [ivB64, authTagB64, dataB64] = textoCifrado.split(":")
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Formato de texto cifrado inválido.")
  }
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const data = Buffer.from(dataB64, "base64")
  const decipher = crypto.createDecipheriv(ALGORITMO, clave, iv)
  decipher.setAuthTag(authTag)
  const descifrado = Buffer.concat([decipher.update(data), decipher.final()])
  return descifrado.toString("utf8")
}

/**
 * Distingue una key ya cifrada (formato iv:authTag:datos) de una key vieja
 * todavía en texto plano (sk-...). Permite que el código siga funcionando
 * con datos antiguos mientras se migran, sin necesidad de un corte abrupto.
 */
export function pareceEncriptado(valor: string): boolean {
  return valor.split(":").length === 3 && !valor.startsWith("sk-")
}

/** Descifra si hace falta, o devuelve tal cual si todavía está en texto plano (dato viejo sin migrar). */
export function desencriptarSiHaceFalta(valor: string): string {
  return pareceEncriptado(valor) ? desencriptar(valor) : valor
}