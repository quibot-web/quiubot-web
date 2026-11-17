import infoGenerada from "./buildInfo.generated.json";

// Visible solo en /admin/* (ver app/admin/layout.tsx) -- para
// confirmar de un vistazo qué versión tiene desplegada staging/prod
// sin depender de un endpoint público. SOURCE_COMMIT es la variable
// que Coolify inyecta en el contenedor ya desplegado -- si está, es
// la fuente de verdad (el commit REAL corriendo, no el que estaba al
// momento del build); si no, se cae al archivo que generarInfoBuild.ts
// dejó en el build (ver scripts/generarInfoBuild.ts, corre como
// "prebuild").
export type InfoBuild = { commit: string; fecha: string };

export function obtenerInfoBuild(): InfoBuild {
  const commitEnv = process.env.SOURCE_COMMIT;
  return {
    commit: commitEnv ? commitEnv.slice(0, 7) : infoGenerada.commit,
    fecha: infoGenerada.fecha,
  };
}
