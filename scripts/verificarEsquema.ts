// scripts/verificarEsquema.ts
//
// Pedido explícito tras el caso real de "gancho_tipo": el código ya
// insertaba esa columna antes de que el SQL que la crea se hubiera
// corrido, y el error real ("Could not find the 'gancho_tipo' column...")
// quedaba enterrado en errores_publicacion en vez de saltar a la vista.
// Este script compara, SOLO LECTURA, las columnas que el código espera
// en publicaciones_organicas (COLUMNAS_PUBLICACIONES_ORGANICAS, la
// misma fuente real que usa app/lib/contenido.ts -- no una copia
// aparte) contra las columnas reales de la base, y dice cuáles faltan.
//
// Se corre así, desde la raíz del proyecto:
//   npm run verificar:esquema
//
// Requiere en tu .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE=...
//
// Nunca inserta, actualiza ni borra nada -- solo un SELECT de 1 fila
// real para leer sus columnas (Supabase/PostgREST no expone
// information_schema por su API REST, así que esta es la forma de
// verificar columnas reales sin agregar una función SQL nueva solo
// para esto).

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { COLUMNAS_PUBLICACIONES_ORGANICAS } from "../app/lib/contenido";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function main() {
  console.log("Verificando columnas de publicaciones_organicas (solo lectura)...\n");

  const { data: filas, error } = await supabase
    .from("publicaciones_organicas")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error leyendo publicaciones_organicas: " + error.message);
    process.exit(1);
  }

  if (!filas || filas.length === 0) {
    console.log("La tabla publicaciones_organicas no tiene ninguna fila todavía.");
    console.log("Este script lee las columnas reales a partir de una fila existente");
    console.log("(no inserta ninguna de prueba) -- revisa el esquema a mano en el SQL");
    console.log("Editor de Supabase, o vuelve a correr esto cuando exista al menos una pieza.");
    process.exit(1);
  }

  const columnasReales = new Set(Object.keys(filas[0]));
  const faltantes = COLUMNAS_PUBLICACIONES_ORGANICAS.filter((c) => !columnasReales.has(c));
  const extras = [...columnasReales].filter((c) => !(COLUMNAS_PUBLICACIONES_ORGANICAS as readonly string[]).includes(c));

  if (faltantes.length === 0) {
    console.log(`✅ Las ${COLUMNAS_PUBLICACIONES_ORGANICAS.length} columnas que el código espera existen en la base.`);
  } else {
    console.log(`⚠️  Faltan ${faltantes.length} columna(s) que el código ya usa, pero la base todavía no tiene:\n`);
    for (const c of faltantes) console.log(`  - ${c}`);
    console.log("\nRevisa docs/sql/contenido_organico.sql para el `alter table` correspondiente a cada una.");
  }

  if (extras.length > 0) {
    console.log(`\n(Informativo) La base tiene ${extras.length} columna(s) que el código no usa: ${extras.join(", ")}`);
  }

  process.exit(faltantes.length > 0 ? 1 : 0);
}

main();
