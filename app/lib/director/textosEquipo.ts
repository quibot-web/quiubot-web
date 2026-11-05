// Plantillas de los mensajes de evento del chat de Equipo (Fase 2,
// Commit 2) -- mismo espíritu que directorTextos.ts: texto en español
// con números reales interpolados, sin IA. El materializador
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

export function textoReporteDiario(params: {
  tipoMeta: TipoMeta | null;
  conversiones: number;
  costoPorResultado: number;
  vsMetaPorcentaje: number | null;
}): MensajeEquipoContenido {
  const unidad = params.tipoMeta ? UNIDAD_RESULTADO[params.tipoMeta] : "resultados";
  const datos: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Resultados de ayer", valor: String(params.conversiones) },
    { etiqueta: "Costo c/u", valor: formatoCop(params.costoPorResultado) },
  ];

  let texto = `Reporte de ayer: ${params.conversiones} ${unidad} a ${formatoCop(params.costoPorResultado)} cada ${params.conversiones === 1 ? "una" : "una"}.`;

  if (params.vsMetaPorcentaje !== null) {
    const flecha = params.vsMetaPorcentaje >= 0 ? "↑" : "↓";
    const pctAbs = Math.abs(Math.round(params.vsMetaPorcentaje));
    texto += ` Vas ${flecha} ${pctAbs}% ${params.vsMetaPorcentaje >= 0 ? "por encima" : "por debajo"} del ritmo de tu meta.`;
    datos.push({ etiqueta: "vs. meta", valor: `${flecha} ${pctAbs}%` });
  }

  return { texto, datos };
}

export function textoCreativosListos(params: { cantidad: number; miniaturas: string[] }): MensajeEquipoContenido {
  const texto =
    params.cantidad === 1
      ? "Tengo listo un anuncio nuevo."
      : `Tengo listos ${params.cantidad} anuncios nuevos.`;
  return { texto, miniaturas: params.miniaturas.slice(0, 6) };
}

export function textoVideoListo(params: { urlVideo: string }): MensajeEquipoContenido {
  return { texto: "Tu video nuevo ya está listo.", miniaturas: [params.urlVideo] };
}
