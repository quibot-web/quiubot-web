import type { RecetaObjetivo } from "./tipos";

// trafico_mensajes ("Clics al enlace") y visitas_web son dos objetivos
// reales distintos en objetivos_config, pero comparten el mismo enfoque
// de curiosidad -- una sola receta, reusada para los dos ids (sección 3B
// corregida: el documento original los mezclaba en una sola fila).
function construirReceta(objetivoId: "trafico_mensajes" | "visitas_web"): RecetaObjetivo {
  return {
    objetivoId,
    enfoque: "Curiosidad: mostrar una parte y dejar el resto en la web. Sin precios ni promesas que no se cumplan.",
    duracionMinS: 8,
    duracionMaxS: 15,
    bloques: ["gancho", "valor", "cta"],
    bucleTipico:
      "\"La 3ª está en la web\" -- el bucle NO se cierra dentro del video a propósito, se cierra yendo al sitio (cierra_en es la escena de cta).",
    indicadorBucle: "espera_final",
    accionCta: "web",
  };
}

export const recetaTraficoMensajes = construirReceta("trafico_mensajes");
export const recetaVisitasWeb = construirReceta("visitas_web");
