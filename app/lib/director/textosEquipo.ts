// Plantillas de los mensajes de evento del chat de Equipo -- mismo
// espíritu que directorTextos.ts/directorChat.ts: texto en español con
// números reales interpolados, sin IA. Corregido (Fase 2, corrección
// de voz): los asistentes NUNCA le hablan directo al usuario -- le
// reportan al Director, y es el Director quien se lo cuenta al
// usuario citando a quien lo dijo. Mismo criterio que ya usa
// leadInPropuesta()/confirmacionExito() de directorChat.ts para las
// propuestas. El materializador
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

  let texto = `El Analista revisó tus campañas: ayer tuviste ${params.conversiones} ${unidad} a ${formatoCop(params.costoPorResultado)} cada ${cadaUno}.`;

  if (params.vsMetaPorcentaje !== null) {
    const flecha = params.vsMetaPorcentaje >= 0 ? "↑" : "↓";
    const pctAbs = Math.abs(Math.round(params.vsMetaPorcentaje));
    texto += ` Vas ${flecha} ${pctAbs}% ${params.vsMetaPorcentaje >= 0 ? "por encima" : "por debajo"} del ritmo de tu meta.`;
    datos.push({ etiqueta: "vs. meta", valor: `${flecha} ${pctAbs}%` });
  }

  return { texto, datos };
}

export function textoCreativosListos(params: { cantidad: number; miniaturas: string[] }): MensajeEquipoContenido {
  const texto = params.cantidad === 1 ? "El Creativo ya tiene listo un anuncio nuevo." : `El Creativo ya tiene listos ${params.cantidad} anuncios nuevos.`;
  return { texto, miniaturas: params.miniaturas.slice(0, 6) };
}

export function textoVideoListo(params: { urlVideo: string }): MensajeEquipoContenido {
  return { texto: "El Creativo ya tiene listo tu video nuevo.", miniaturas: [params.urlVideo] };
}
