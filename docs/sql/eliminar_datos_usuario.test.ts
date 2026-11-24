import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// El script de eliminación de datos (docs/sql/eliminar_datos_usuario.sql)
// tiene que cubrir TODA tabla con datos de un usuario. Si alguien agrega una
// tabla nueva en el código, este test falla hasta que se sume al script o a
// esta lista de tablas que no guardan datos de un usuario.
const TABLAS_SIN_DATOS_DE_USUARIO = [
  "pistas_musicales", // biblioteca de música (de Quiubot y colaboradores)
  "novedades",
  "plantillas_publicitarias",
  "plantillas_video_segmentos",
  "objetivos_config",
  "banners_home",
  "tutoriales_videos",
  "tutoriales_testimonios",
  "asistente_conocimiento",
  "ai_playbook",
  "costos_referencia",
  "config_home",
];

const raiz = path.resolve(__dirname, "../..");
const sql = fs.readFileSync(path.join(raiz, "docs/sql/eliminar_datos_usuario.sql"), "utf8");
const sinComentarios = sql.replace(/--.*$/gm, "");

function tablasDelCodigo(): string[] {
  const tablas = new Set<string>();
  const recorrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) for (const m of fs.readFileSync(p, "utf8").matchAll(/\.from\("([A-Za-z0-9_]+)"\)/g)) tablas.add(m[1]);
    }
  };
  for (const d of ["app", "lib", "scripts"]) if (fs.existsSync(path.join(raiz, d))) recorrer(path.join(raiz, d));
  return [...tablas].sort();
}

describe("script de eliminación de datos de un usuario", () => {
  const borradas = [...sinComentarios.matchAll(/delete from "?([A-Za-z0-9_]+)"?/g)].map((m) => m[1]);

  it("cada tabla que usa el código se borra en el paso 2 o está en la lista de tablas sin datos de usuario", () => {
    const sinCubrir = tablasDelCodigo().filter((t) => !borradas.includes(t) && !TABLAS_SIN_DATOS_DE_USUARIO.includes(t));
    expect(sinCubrir).toEqual([]);
  });

  it("cada tabla que se borra también se cuenta en la verificación (pasos 1 y 3), y usuarios va al final", () => {
    for (const t of borradas) expect(sinComentarios, t).toMatch(new RegExp(`select '${t}'`));
    expect(borradas[borradas.length - 1]).toBe("usuarios");
    expect(borradas).toContain("publicaciones_organicas");
  });

  it("es seguro de correr: todo en un bloque (una transacción), y se niega si el id no corresponde al correo o si la cuenta es admin", () => {
    expect(sinComentarios).toMatch(/do \$\$[\s\S]*end \$\$;/);
    expect(sinComentarios).toMatch(/if not found then\s+raise exception/);
    expect(sinComentarios).toMatch(/if v_rol = 'admin' then\s+raise exception/);
  });
});
