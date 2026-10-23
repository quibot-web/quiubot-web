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
import { nombreVisiblePlan, type PlanId } from "@/app/lib/planesConfig";

export const NOMBRE_ASISTENTE: Record<Asistente, string> = {
  director: "Director",
  marca: "Analista de marca",
  estratega: "Estratega",
  creativo: "Creativo",
  publicador: "Publicador",
  analista: "Analista de campañas",
  optimizador: "Optimizador",
};

// Mismo asistente que usa de verdad el Director/el encadenamiento (ver
// app/api/cron/director/route.ts y revisarGeneracionCreativos en
// app/lib/propuestas.ts) -- una sola fuente de verdad para qué
// asistente corresponde a cada acción.
export const ASISTENTE_POR_ACCION: Record<AccionPropuesta, Asistente> = {
  generar_estrategia: "estratega",
  crear_creativos: "creativo",
  publicar_campana: "publicador",
  pausar: "optimizador",
  ajustar_presupuesto: "optimizador",
  agregar_anuncios: "publicador",
};

// El asistente que de verdad corresponde a un mensaje: si tiene
// accion, SIEMPRE se deduce de ahí con ASISTENTE_POR_ACCION, nunca del
// campo asistente guardado en la fila -- así un dato de prueba viejo,
// o un error futuro al guardar, nunca cambia qué esfera se muestra ni
// a qué filtro responde. El campo asistente guardado solo se usa
// cuando no hay accion (notificaciones legadas, campañas con problema).
export function asistenteDeMensaje(p: { accion: AccionPropuesta | null; asistente: Asistente }): Asistente {
  return p.accion ? ASISTENTE_POR_ACCION[p.accion] : p.asistente;
}

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
      // Si no sabemos cuántos son, se omite el número -- nunca "0
      // anuncios" inventado.
      if (cantidadCreativos == null) return `El Publicador tiene anuncios nuevos listos para ${campana}.`;
      const n = cantidadCreativos;
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
// con los números reales cuando los hay. Si falta un dato, se omite la
// frase que lo necesita -- nunca se muestra un 0 o un vacío inventado
// (ajustar_presupuesto puede subir o bajar, por eso "de $X a $Y" en
// vez de asumir que siempre sube, pero solo si ambos números existen).
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
      if (datos.presupuestoAntes == null || datos.presupuestoDespues == null) {
        return `Listo, el Optimizador ajustó el presupuesto de ${campana}.`;
      }
      return `Listo, el Optimizador ajustó el presupuesto de ${campana} de ${formatoCop(datos.presupuestoAntes)} a ${formatoCop(datos.presupuestoDespues)}.`;
    case "agregar_anuncios": {
      if (datos.cantidadAnuncios == null) return `Listo, el Publicador agregó los anuncios a ${campana}.`;
      const n = datos.cantidadAnuncios;
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

// --- Recordatorio de renovación del plan -- misma voz del Director,
// calculado en vivo (ver app/lib/renovacion.ts), nunca persistido. ---

const IDS_PLAN: PlanId[] = ["arranque", "crecimiento", "escala"];

// El Director siempre dice el mismo nombre que ve el cliente en la
// página de planes y en sus correos -- ver nombreVisiblePlan en
// planesConfig.ts, la única fuente de verdad para eso.
export function nombrePlan(planId: string): string {
  return IDS_PLAN.includes(planId as PlanId) ? nombreVisiblePlan(planId as PlanId) : planId;
}

type ResultadosPeriodo = { cantidad: number; tipoLabel: string; costoPromedio: number } | null;

// 3 días antes de vencer -- misma ventana que ya usa el correo de
// /api/cron/recordatorio-vencimiento. "Desde tu último pago" y no
// "este mes": en un ciclo anual la ventana real es un año, no 30 días.
export function textoRecordatorio3Dias(nombrePlanTexto: string, fecha: string, resultados: ResultadosPeriodo): string {
  const frase = resultados
    ? ` Desde tu último pago, el equipo consiguió ${resultados.cantidad} ${resultados.tipoLabel} a ${formatoCop(resultados.costoPromedio)} cada uno.`
    : "";
  return `Tu plan ${nombrePlanTexto} vence el ${fecha}.${frase} ¿Seguimos trabajando juntos?`;
}

export const TEXTO_HOY_VENCE = "Hoy vence tu plan. Si renuevas, el equipo sigue sin pausa.";

export const TEXTO_VENCIDO = "Tu plan venció y el equipo quedó en pausa. Cuando renueves, retomamos donde íbamos.";

export function textoRecienPagado(fecha: string): string {
  return `¡Gracias! Renovaste hasta el ${fecha}. Seguimos con tu meta.`;
}
