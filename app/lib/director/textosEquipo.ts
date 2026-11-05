// Plantillas de los mensajes de evento del chat de Equipo -- mismo
// espíritu que directorTextos.ts/directorChat.ts: texto en español con
// números reales interpolados, sin IA. Corregido (Fase 2, corrección
// de voz): los asistentes NUNCA le hablan directo al usuario -- le
// reportan al Director. Cada función devuelve DOS versiones del mismo
// evento real: "texto" (el Director se lo cuenta al usuario en el
// grupo, citando al asistente -- mismo criterio que
// leadInPropuesta()/confirmacionExito() de directorChat.ts) y
// "textoInterno"/"respuestaDirector" (la transcripción de solo lectura
// asistente→Director del chat individual, Commit 2). El materializador
// (app/api/cron/materializar-mensajes-equipo/route.ts) es el único que
// llama estas funciones.
import type { TipoMeta } from "@/app/lib/metas";
import { formatoCop } from "@/app/lib/directorTextos";
import type { MensajeEquipoContenido } from "@/app/lib/director/mensajeEquipo.schema";

const UNIDAD_RESULTADO: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "conversaciones",
  leads: "leads",
  ventas_web: "ventas",
  visitas_web: "visitas",
  seguidores_facebook: "seguidores",
  seguidores_instagram: "seguidores",
};

// "cada una" (conversaciones/ventas/visitas) vs "cada uno" (leads/seguidores).
const GENERO_FEMENINO: Record<TipoMeta, boolean> = {
  conversaciones_whatsapp: true,
  leads: false,
  ventas_web: true,
  visitas_web: true,
  seguidores_facebook: false,
  seguidores_instagram: false,
};

export function textoReporteDiario(params: {
  tipoMeta: TipoMeta | null;
  conversiones: number;
  costoPorResultado: number;
  vsMetaPorcentaje: number | null;
}): MensajeEquipoContenido {
  const unidad = params.tipoMeta ? UNIDAD_RESULTADO[params.tipoMeta] : "resultados";
  const cadaUno = params.tipoMeta && GENERO_FEMENINO[params.tipoMeta] ? "una" : "uno";
  const datos: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Resultados de ayer", valor: String(params.conversiones) },
    { etiqueta: "Costo c/u", valor: formatoCop(params.costoPorResultado) },
  ];

  const resumen = `ayer tuviste ${params.conversiones} ${unidad} a ${formatoCop(params.costoPorResultado)} cada ${cadaUno}`;
  let texto = `El Analista revisó tus campañas: ${resumen}.`;
  let textoInterno = `Director, revisé las campañas: ${resumen}.`;

  if (params.vsMetaPorcentaje !== null) {
    const flecha = params.vsMetaPorcentaje >= 0 ? "↑" : "↓";
    const pctAbs = Math.abs(Math.round(params.vsMetaPorcentaje));
    const vsMeta = ` Vas ${flecha} ${pctAbs}% ${params.vsMetaPorcentaje >= 0 ? "por encima" : "por debajo"} del ritmo de tu meta.`;
    texto += vsMeta;
    textoInterno += vsMeta.replace("Vas", "Va");
    datos.push({ etiqueta: "vs. meta", valor: `${flecha} ${pctAbs}%` });
  }

  const respuestaDirector = params.vsMetaPorcentaje !== null && params.vsMetaPorcentaje < 0 ? "Gracias, lo tengo en cuenta para la próxima revisión." : "Perfecto, se lo cuento a Juan.";

  return { texto, datos, textoInterno, respuestaDirector };
}

export function textoCreativosListos(params: { cantidad: number; miniaturas: string[] }): MensajeEquipoContenido {
  const texto = params.cantidad === 1 ? "El Creativo ya tiene listo un anuncio nuevo." : `El Creativo ya tiene listos ${params.cantidad} anuncios nuevos.`;
  const textoInterno = params.cantidad === 1 ? "Director, ya tengo listo un anuncio nuevo." : `Director, ya tengo listos ${params.cantidad} anuncios nuevos.`;
  return { texto, miniaturas: params.miniaturas.slice(0, 6), textoInterno, respuestaDirector: "Perfecto, lo uso para sus anuncios." };
}

export function textoVideoListo(params: { urlVideo: string }): MensajeEquipoContenido {
  return {
    texto: "El Creativo ya tiene listo tu video nuevo.",
    miniaturas: [params.urlVideo],
    textoInterno: "Director, ya tengo listo el video nuevo.",
    respuestaDirector: "Perfecto, lo uso para sus anuncios.",
  };
}
