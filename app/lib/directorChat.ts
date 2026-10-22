// Plantillas de NARRACIÓN para la conversación con el Director en
// /decisiones -- separado de directorTextos.ts (que genera titulo/
// justificacion/impactoEsperado para GUARDAR en una propuesta real).
// Todo lo de aquí es puramente de lectura: arma frases a partir de
// datos que ya existen, nunca se persiste, nunca usa IA. El cliente
// siempre habla con el Director: estas funciones son su voz, en
// primera persona, de "tú", cercano y sin culpar al cliente ni a los
// demás asistentes.
import type { AccionPropuesta, Asistente } from "@/app/lib/metas";
import { formatoCop } from "@/app/lib/directorTextos";

export const NOMBRE_ASISTENTE: Record<Asistente, string> = {
  director: "Director",
  marca: "Analista de marca",
  estratega: "Estratega",
  creativo: "Creativo",
  publicador: "Publicador",
  analista: "Analista de campañas",
  optimizador: "Optimizador",
};

function nombreCampanaOFallback(campanaNombre: string | null): string {
  return campanaNombre ? `"${campanaNombre}"` : "esta campaña";
}

// Lo que el Director dice ANTES de citar título/justificación/impacto
// de una propuesta pendiente -- una frase por acción, en primera
// persona, nombrando la campaña cuando existe. agregar_anuncios
// necesita además cuántos creativos trae.
export function leadInPropuesta(
  accion: AccionPropuesta,
  campanaNombre: string | null,
  cantidadCreativos?: number
): string {
  const campana = nombreCampanaOFallback(campanaNombre);
  switch (accion) {
    case "generar_estrategia":
      return "Le pedí al Estratega que revisara tu meta.";
    case "crear_creativos":
      return campanaNombre
        ? `Le pedí al Creativo que preparara ideas nuevas para los anuncios de ${campana}.`
        : "Le pedí al Creativo que preparara ideas nuevas para tus anuncios.";
    case "publicar_campana":
      return `El Publicador tiene ${campana} lista para publicar.`;
    case "pausar":
      return `El Optimizador revisó tus campañas y recomienda pausar ${campana}.`;
    case "ajustar_presupuesto":
      return `El Optimizador recomienda ajustar el presupuesto de ${campana}.`;
    case "agregar_anuncios": {
      const n = cantidadCreativos ?? 0;
      const anuncio = n === 1 ? "anuncio" : "anuncios";
      const nuevo = n === 1 ? "nuevo" : "nuevos";
      const listo = n === 1 ? "listo" : "listos";
      return `El Publicador tiene ${n} ${anuncio} ${nuevo} ${listo} para ${campana}.`;
    }
  }
}

// El cuerpo de la propuesta en párrafos cortos -- título en negrita
// (lo renderiza page.tsx), después la justificación, después el
// impacto si viene, y la pregunta de cierre. Estructurado (no un solo
// string) porque la UI necesita poner el título en <b>.
export type CuerpoPropuesta = {
  tituloNegrita: string;
  justificacion: string;
  impacto: string | null;
  pregunta: string;
};

export function cuerpoPropuesta(datos: {
  titulo: string;
  justificacion: string;
  impactoEsperado: string | null;
}): CuerpoPropuesta {
  return {
    tituloNegrita: datos.titulo,
    justificacion: datos.justificacion,
    impacto: datos.impactoEsperado ? `Lo que esperamos: ${datos.impactoEsperado}` : null,
    pregunta: "¿Le doy luz verde?",
  };
}

// Confirmación del Director tras ejecutar con éxito -- una por acción,
// con los números reales. ajustar_presupuesto puede subir o bajar, por
// eso dice "de $X a $Y" en vez de asumir que siempre sube.
export function confirmacionExito(
  accion: AccionPropuesta,
  datos: {
    campanaNombre: string | null;
    presupuestoAntes?: number;
    presupuestoDespues?: number;
    cantidadAnuncios?: number;
  }
): string {
  const campana = nombreCampanaOFallback(datos.campanaNombre);
  switch (accion) {
    case "pausar":
      return `Listo, el Optimizador pausó ${campana}.`;
    case "ajustar_presupuesto":
      return `Listo, el Optimizador ajustó el presupuesto de ${campana} de ${formatoCop(datos.presupuestoAntes ?? 0)} a ${formatoCop(datos.presupuestoDespues ?? 0)}.`;
    case "agregar_anuncios": {
      const n = datos.cantidadAnuncios ?? 0;
      return `Listo, el Publicador agregó ${n} anuncio${n === 1 ? "" : "s"} a ${campana}.`;
    }
    default:
      return "Listo, quedó hecho.";
  }
}

// Falla: siempre el error real, en palabras simples -- nunca un
// mensaje propio que lo reemplace. motivo === "token_meta" agrega un
// segundo aviso (page.tsx le pone el enlace a /integraciones).
export function confirmacionFalla(
  asistente: Asistente,
  errorReal: string,
  motivo?: string
): { texto: string; avisoReconectarMeta: boolean } {
  return {
    texto: `${NOMBRE_ASISTENTE[asistente]} no pudo terminarlo. Esto fue lo que pasó: ${errorReal}`,
    avisoReconectarMeta: motivo === "token_meta",
  };
}

export const TEXTO_RECHAZO = "Entendido, lo dejamos así por ahora.";

export const TEXTO_VENCIDA =
  "Como no alcanzamos a revisarlo a tiempo, lo dejé quieto. Si vuelve a hacer falta, te lo propongo de nuevo.";

// Narración de las etapas de crear_creativos mientras está en curso
// (no son decisiones, no llevan botones) -- el Creativo queda en
// "trabajando" mientras se muestran.
export function narracionEtapaCreativos(etapa: "esperando_fotos" | "generando_conceptos" | "generando"): string {
  switch (etapa) {
    case "esperando_fotos":
      return "Para que el Creativo pueda avanzar, necesito que subas de 1 a 3 fotos del producto.";
    case "generando_conceptos":
      return "El Creativo está pensando conceptos nuevos para tus anuncios…";
    case "generando":
      return "El Creativo está generando tus imágenes…";
  }
}

// --- Narración de eventos de bitácora que no están atados 1 a 1 a una
// propuesta decidida (esos se narran con las plantillas de arriba, en
// pasado). Solo estos tres tipos de evento se narran -- los demás son
// bitácora interna/operativa (candados, reintentos, revisiones con
// propuesta, etc.) y quedarían fuera del historial, tal como se
// acordó. ---

export function narracionMetaCreada(detalle: { tipo?: string; cantidad_objetivo?: number; fecha_fin?: string }): string {
  const tipoLabel = detalle.tipo === "leads" ? "leads" : "conversaciones de WhatsApp";
  const fecha = detalle.fecha_fin ? new Date(detalle.fecha_fin).toLocaleDateString("es-CO") : null;
  return detalle.cantidad_objetivo
    ? `Creamos tu meta: ${detalle.cantidad_objetivo} ${tipoLabel}${fecha ? ` antes del ${fecha}` : ""}.`
    : "Creamos tu meta nueva.";
}

export const TEXTO_AUTOPILOTO_PAUSADO = "Pausaste el Autopiloto. El equipo queda quieto hasta que lo reactives.";
export const TEXTO_AUTOPILOTO_REANUDADO = "Reactivaste el Autopiloto. El equipo sigue trabajando por ti.";

// "Hoy revisé y no hace falta nada" -- el mensaje que hace sentir que
// Quiubot trabaja aunque no pida nada. Solo se narra la corrida MÁS
// RECIENTE de este tipo (page.tsx filtra las demás), y solo cuando esa
// corrida no propuso nada (si propuso algo, esa propuesta ya se narra
// por su cuenta -- narrar también el evento duplicaría el mensaje).
export function narracionRevisionSinPropuestas(
  avanceResumen: { conversiones: number } | null,
  cantidadObjetivo: number | null
): string {
  if (!avanceResumen) return "Hoy revisé tu meta con el equipo. No hace falta cambiar nada por ahora.";
  if (cantidadObjetivo != null) {
    return `Hoy revisé tu meta con el equipo: vas ${avanceResumen.conversiones} de ${cantidadObjetivo}. No hace falta cambiar nada por ahora.`;
  }
  return `Hoy revisé tu meta con el equipo: vas ${avanceResumen.conversiones} resultados hasta ahora. No hace falta cambiar nada por ahora.`;
}

// Una corrida de director_revision "cuenta" para narracionRevisionSinPropuestas
// solo si tiene avance_resumen/evaluaciones (no la variante
// tope_diario_alcanzado, que no trae esos campos) y ninguna de sus
// evaluaciones propuso algo (si propuso algo, esa propuesta ya tiene
// su propio mensaje).
export function revisionNoPropusoNada(detalle: { evaluaciones?: { propuso?: boolean }[] }): boolean {
  if (!Array.isArray(detalle.evaluaciones)) return false;
  return !detalle.evaluaciones.some((e) => e.propuso === true);
}
