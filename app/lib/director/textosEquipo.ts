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
// (app/api/cron/materializar-mensajes-equipo/route.ts) llama la
// mayoría de estas funciones; textoReelPublicado/textoReelPublicacionError/
// textoReelVencido las llama app/lib/publicadorOrganico.ts (el
// publicador no tiene nada que "materializar" después, el evento ya
// es en tiempo real).
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
  nombreUsuario: string;
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

  const respuestaDirector =
    params.vsMetaPorcentaje !== null && params.vsMetaPorcentaje < 0 ? "Gracias, lo tengo en cuenta para la próxima revisión." : `Perfecto, se lo cuento a ${params.nombreUsuario}.`;

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

export function textoAdnMarcaListo(params: { nombreUsuario: string; fraseCorta: string | null; colores: string[] }): MensajeEquipoContenido {
  const colores = params.colores.length > 0 ? `, con colores ${params.colores.join(", ")}` : "";
  const detalle = params.fraseCorta ? `: transmite ${params.fraseCorta}${colores}` : colores;
  return {
    texto: `Marca terminó de analizar tu marca${detalle}.`,
    textoInterno: `Director, terminé de analizar la marca de ${params.nombreUsuario}${detalle}.`,
    respuestaDirector: "Perfecto, lo uso para sus anuncios.",
  };
}

// Publicador automático de contenido orgánico (paso 4 de la
// integración de Fase B v2.0, app/api/cron/publicar-organico/route.ts).
export function textoReelPublicado(params: { permalink: string | null }): MensajeEquipoContenido {
  return {
    texto: "El Publicador ya subió tu reel a Instagram.",
    textoInterno: "Director, ya publiqué el reel programado en Instagram.",
    respuestaDirector: "Perfecto, gracias por avisar.",
    acciones: params.permalink ? [{ label: "Ver en Instagram", tipo: "link", href: params.permalink }] : undefined,
  };
}

// motivo distingue el texto que ve el usuario (no el tipo_error crudo
// de la fila): "reconexion" (token vencido/permiso faltante, pide
// reconectar), "revisar" (se atascó publicando -- puede que Instagram
// sí lo haya publicado, hay que mirar antes de reprogramar) y "otro"
// (Meta rechazó el video, revisar /contenido a mano).
export function textoReelPublicacionError(params: { motivo: "reconexion" | "revisar" | "otro" }): MensajeEquipoContenido {
  if (params.motivo === "reconexion") {
    return {
      texto: "El Publicador no pudo subir tu reel: tu conexión con Meta venció o le falta un permiso. Reconecta Meta y después reintenta el reel desde Contenido -- no se perdió.",
      textoInterno: "Director, no pude publicar el reel -- la conexión con Meta venció o le falta un permiso.",
      respuestaDirector: "Entendido, le aviso para que reconecte.",
      acciones: [
        { label: "Reconectar Meta", tipo: "link", href: "/api/meta/conectar" },
        { label: "Ver en Contenido", tipo: "link", href: "/contenido" },
      ],
    };
  }
  if (params.motivo === "revisar") {
    return {
      texto: "El Publicador no pudo confirmar si tu reel quedó publicado. Revisa tu Instagram antes de volver a programarlo, para no subirlo dos veces.",
      textoInterno: "Director, no pude confirmar si el reel quedó publicado -- hay que revisarlo en Instagram antes de reprogramarlo.",
      respuestaDirector: "Entendido, le aviso para que lo revise.",
      acciones: [{ label: "Revisar en Contenido", tipo: "link", href: "/contenido" }],
    };
  }
  return {
    texto: "El Publicador no pudo subir tu reel a Instagram. Revisa el reel en Contenido antes de volver a programarlo.",
    textoInterno: "Director, no pude publicar el reel -- necesita revisión manual.",
    respuestaDirector: "Entendido, le aviso para que lo revise.",
    acciones: [{ label: "Revisar en Contenido", tipo: "link", href: "/contenido" }],
  };
}

// Reel que no salió a su hora sin que haya fallado nada en Meta:
// "sin_video" (pasó la hora y nunca se terminó el video -- la pieza
// queda vencida), "requiere_confirmacion" (QC forzado, falta "Publicar
// de todos modos") o "musica_sin_licencia" (la pista no tiene licencia
// para Instagram). Los 2 últimos siguen en "lista": apenas se resuelva
// el motivo, el Publicador lo sube en su siguiente vuelta.
export function textoReelVencido(params: {
  motivo: "sin_video" | "requiere_confirmacion" | "musica_sin_licencia" | "atrasada";
  piezaId?: string;
  horasMaximas?: number;
}): MensajeEquipoContenido {
  if (params.motivo === "atrasada") {
    return {
      texto: `El Publicador no subió un reel porque su hora ya había pasado hace más de ${params.horasMaximas ?? 2} horas -- nunca publica algo viejo sin que lo decidas tú. Puedes publicarlo ahora o reprogramarlo.`,
      textoInterno: "Director, no publiqué un reel porque estaba muy atrasado -- queda para que decidan si sale ahora o se reprograma.",
      respuestaDirector: "Entendido, le pregunto qué prefiere.",
      acciones: [{ label: "Publicar ahora o reprogramar", tipo: "link", href: params.piezaId ? `/contenido/${params.piezaId}` : "/contenido" }],
    };
  }
  if (params.motivo === "requiere_confirmacion") {
    return {
      texto: "El Publicador no subió tu reel a su hora: no pasó el control de calidad y espera que confirmes \"Publicar de todos modos\".",
      textoInterno: "Director, no publiqué el reel programado -- no pasó el control de calidad y falta la confirmación.",
      respuestaDirector: "Entendido, le pido que lo revise.",
      acciones: [{ label: "Revisar en Contenido", tipo: "link", href: "/contenido" }],
    };
  }
  if (params.motivo === "musica_sin_licencia") {
    return {
      texto: "El Publicador no subió tu reel a su hora: la música elegida no tiene licencia para Instagram. Cámbiala en Contenido.",
      textoInterno: "Director, no publiqué el reel programado -- la música no tiene licencia para Instagram.",
      respuestaDirector: "Entendido, le pido que cambie la música.",
      acciones: [{ label: "Revisar en Contenido", tipo: "link", href: "/contenido" }],
    };
  }
  return {
    texto: "Se pasó la hora de un reel programado y el video nunca quedó listo, así que no se publicó. Puedes reprogramarlo en Contenido.",
    textoInterno: "Director, un reel programado se venció -- el video nunca quedó listo a tiempo.",
    respuestaDirector: "Entendido, le aviso para que lo reprograme.",
    acciones: [{ label: "Ir a Contenido", tipo: "link", href: "/contenido" }],
  };
}
