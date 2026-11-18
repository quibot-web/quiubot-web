// Regresión de glifos (18 nov 2026): el render corre en el navegador de
// cada cliente, y un carácter que no está en nuestras 4 fuentes
// (video/fuentes.ts) depende de que ESE computador tenga una fuente de
// respaldo que lo cubra -- si no, sale un cuadro blanco (caso real: ✗ en
// conexion_whatsapp y ✓✓ en respuesta_lenta, que pueden ir en el gancho,
// la portada). Los íconos se dibujan con SVG (video/iconos.tsx).
//
// Este test recorre el código (sin comentarios) de visuales, escenas y
// capas y falla si aparece un carácter que no esté en video/glifos.ts
// (verificado contra el cmap real de las 4 fuentes con fontTools).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { caracterEnFuentes } from "./glifos";

const CARPETAS = ["video/visuales", "video/escenas", "video/capas", "video/estilos"];

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("ningún componente pinta un glifo fuera de nuestras fuentes", () => {
  const archivos = CARPETAS.flatMap((carpeta) =>
    fs
      .readdirSync(path.join(process.cwd(), carpeta))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => path.join(carpeta, f))
  );

  it("hay archivos que revisar", () => {
    expect(archivos.length).toBeGreaterThan(25);
  });

  for (const archivo of archivos) {
    it(archivo, () => {
      const codigo = sinComentarios(fs.readFileSync(path.join(process.cwd(), archivo), "utf8"));
      const fuera = [...new Set([...codigo].filter((c) => c.codePointAt(0)! > 127 && !caracterEnFuentes(c)))];
      expect(fuera, `usa ${fuera.join(" ")} -- dibújalo con un ícono de video/iconos.tsx`).toEqual([]);
    });
  }
});
