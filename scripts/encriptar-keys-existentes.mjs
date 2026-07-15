// scripts/encriptar-keys-existentes.mjs
//
// Script de un solo uso: cifra cualquier openai_key que todavia este en texto
// plano en la base de datos. Es seguro correrlo varias veces, las keys que
// ya estan cifradas se dejan intactas.
//
// Se corre asi, desde la raiz del proyecto:
//   node scripts/encriptar-keys-existentes.mjs
//
// Requiere en tu .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE=...
//   ENCRYPTION_KEY=...   (la misma que configuraste en Coolify)

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
  return valor.split(":").length === 3 && !valor.startsWith("sk-")
}

async function main() {
  console.log("Buscando usuarios con openai_key configurada...")
  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, email, openai_key")
    .not("openai_key", "is", null)

  if (error) {
    console.error("Error al leer usuarios: " + error.message)
    process.exit(1)
  }

  console.log("Encontrados " + usuarios.length + " usuarios con key configurada.")
  console.log("")

  let migrados = 0
  let yaEncriptados = 0
  let fallidos = 0

  for (const u of usuarios) {
    if (pareceEncriptado(u.openai_key)) {
      yaEncriptados++
      continue
    }

    const cifrado = encriptar(u.openai_key)
    const { error: errUpdate } = await supabase
      .from("usuarios")
      .update({ openai_key: cifrado })
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
  console.log("Listo. " + migrados + " keys cifradas ahora, " + yaEncriptados + " ya estaban cifradas, " + fallidos + " fallaron.")
}

main()
