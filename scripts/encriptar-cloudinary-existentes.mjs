// scripts/encriptar-cloudinary-existentes.mjs
//
// Script de un solo uso: cifra cloudinary_key y cloudinary_secret que todavia
// esten en texto plano. Seguro correrlo varias veces, las que ya estan
// cifradas se dejan intactas.
//
// Se corre asi, desde la raiz del proyecto:
//   node scripts/encriptar-cloudinary-existentes.mjs
//
// Requiere las mismas 3 variables que el script de openai_key, en tu .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE, ENCRYPTION_KEY

import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { config } from "dotenv"

config({ path: ".env.local" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!SUPABASE_URL || !SERVICE_ROLE || !ENCRYPTION_KEY) {
  console.error("Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE, ENCRYPTION_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

const clave = Buffer.from(ENCRYPTION_KEY, "base64")
if (clave.length !== 32) {
  console.error("ENCRYPTION_KEY debe decodificar a exactamente 32 bytes en base64.")
  process.exit(1)
}

function encriptar(texto) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", clave, iv)
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("base64"), authTag.toString("base64"), cifrado.toString("base64")].join(":")
}

function pareceEncriptado(valor) {
  return valor.split(":").length === 3
}

async function main() {
  console.log("Buscando usuarios con credenciales de Cloudinary configuradas...")
  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, email, cloudinary_key, cloudinary_secret")
    .not("cloudinary_key", "is", null)

  if (error) {
    console.error("Error al leer usuarios: " + error.message)
    process.exit(1)
  }

  console.log("Encontrados " + usuarios.length + " usuarios con credenciales configuradas.")
  console.log("")

  let migrados = 0
  let yaEncriptados = 0
  let fallidos = 0

  for (const u of usuarios) {
    const keyYaCifrada = pareceEncriptado(u.cloudinary_key)
    const secretYaCifrado = u.cloudinary_secret ? pareceEncriptado(u.cloudinary_secret) : true

    if (keyYaCifrada && secretYaCifrado) {
      yaEncriptados++
      continue
    }

    const nuevaKey = keyYaCifrada ? u.cloudinary_key : encriptar(u.cloudinary_key)
    const nuevoSecret = u.cloudinary_secret
      ? (secretYaCifrado ? u.cloudinary_secret : encriptar(u.cloudinary_secret))
      : null

    const { error: errUpdate } = await supabase
      .from("usuarios")
      .update({ cloudinary_key: nuevaKey, cloudinary_secret: nuevoSecret })
      .eq("id", u.id)

    if (errUpdate) {
      console.error("  [ERROR] " + u.email + ": " + errUpdate.message)
      fallidos++
    } else {
      console.log("  [OK] Migrado: " + u.email)
      migrados++
    }
  }

  console.log("")
  console.log("Listo. " + migrados + " credenciales cifradas ahora, " + yaEncriptados + " ya estaban cifradas, " + fallidos + " fallaron.")
}

main()
