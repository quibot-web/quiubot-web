import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath+dirname en vez de import.meta.dirname: ese azúcar
// recién llegó en Node 20.11/21.2 -- el engines de package.json pide
// solo >=20.9.0, así que una versión exacta en ese rango se quedaría
// sin prebuild (y por lo tanto, sin esta línea de versión en todo
// /admin) sin este cuidado.
const directorioActual = dirname(fileURLToPath(import.meta.url));

// Se corre como "prebuild" (ver package.json) -- antes de cada
// "npm run build" real, deja el commit/fecha reales en un archivo que
// app/lib/buildInfo.ts importa. SOURCE_COMMIT (la variable que
// Coolify inyecta en el contenedor desplegado) tiene prioridad en
// runtime sobre este archivo -- esto es solo el respaldo para cuando
// esa variable no está disponible (build local, otro host).
function commitActual(): string {
  try {
    return execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "sin-info";
  }
}

const destino = resolve(directorioActual, "..", "app", "lib", "buildInfo.generated.json");
writeFileSync(destino, JSON.stringify({ commit: commitActual(), fecha: new Date().toISOString() }, null, 2) + "\n");
