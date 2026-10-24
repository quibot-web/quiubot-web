// Textos de las propuestas del Director -- plantillas en español con los
// números reales interpolados, sin IA (no gastamos la llave de OpenAI
// del cliente para esto). Una función por regla, ver /api/cron/director.
import type { TipoMeta } from "@/app/lib/metas";

export type TextoPropuesta = {
  titulo: string;
  justificacion: string;
  impactoEsperado: string;
  costoEstimadoCop: number | null;
};

const TIPO_LABEL: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "conversaciones de WhatsApp",
  leads: "leads",
  ventas_web: "ventas en tu sitio web",
};

export function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

// Para montos que vienen de valor_conversion (el ingreso real que
// reportó el pixel) -- a diferencia de presupuesto/costo objetivo, que
// siempre son COP por diseño del producto, el ingreso está en la
// moneda real de la cuenta publicitaria (campanas_publicadas.moneda).
// Sin moneda guardada todavía, se asume COP (mismo criterio de
// respaldo que ya usa el resto del producto).
export function formatoMoneda(valor: number, moneda: string | null): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda || "COP", maximumFractionDigits: 0 }).format(valor);
}

export function textoGenerarEstrategia(datos: { tipo: TipoMeta; cantidadObjetivo: number }): TextoPropuesta {
  const tipoLabel = TIPO_LABEL[datos.tipo];
  return {
    titulo: "Generar una estrategia para tu meta",
    justificacion: `Tu meta de ${datos.cantidadObjetivo} ${tipoLabel} todavía no tiene ninguna campaña activa trabajando en ella. El Estratega puede generar una campaña nueva alineada a este objetivo.`,
    impactoEsperado: "Una campaña nueva lista para revisar y publicar.",
    costoEstimadoCop: null,
  };
}

export function textoPausar(datos: {
  nombreCampana: string;
  gasto: number;
  costoObjetivo: number;
  // Solo viene en metas ventas_web cuando lo que disparó la regla fue
  // el retorno (ROAS) bajo, no la falta total de resultados -- cambia
  // la frase inicial, porque "sin ningún resultado" sería falso: sí
  // hay ventas, solo que el retorno no alcanza el mínimo pedido.
  roasBajo?: { valor: number; minimo: number; moneda: string | null };
}): TextoPropuesta {
  const cuerpo = datos.roasBajo
    ? `"${datos.nombreCampana}" está devolviendo ${datos.roasBajo.valor.toFixed(2)} veces lo invertido en los últimos días -- por debajo del mínimo de ${datos.roasBajo.minimo}x que pediste, con ${formatoMoneda(datos.gasto, datos.roasBajo.moneda)} ya gastados.`
    : `"${datos.nombreCampana}" lleva gastados ${formatoCop(datos.gasto)} sin ningún resultado -- más del doble de tu costo objetivo (${formatoCop(datos.costoObjetivo)} por resultado).`;
  return {
    titulo: `Pausar "${datos.nombreCampana}"`,
    justificacion: `${cuerpo} Pausarla evita seguir invirtiendo presupuesto mientras revisas qué ajustar.`,
    impactoEsperado: "Deja de gastar presupuesto en esta campaña.",
    costoEstimadoCop: null,
  };
}

export function textoAjustarPresupuesto(datos: {
  nombreCampana: string;
  costoActual: number | null;
  costoObjetivo: number;
  presupuestoActual: number;
  presupuestoNuevo: number;
  proyeccionNueva: number;
  cantidadObjetivo: number;
  // Solo en ventas_web cuando lo que calificó la campaña como "funciona
  // bien" fue el retorno, no (o no solo) el costo por resultado.
  roasBueno?: { valor: number; minimo: number };
}): TextoPropuesta {
  const desempeno = datos.roasBueno
    ? `está devolviendo ${datos.roasBueno.valor.toFixed(2)} veces lo invertido (tu mínimo para subir presupuesto es ${datos.roasBueno.minimo.toFixed(2)}x)`
    : datos.costoActual != null
      ? `consigue resultados a ${formatoCop(datos.costoActual)} (tu objetivo es ${formatoCop(datos.costoObjetivo)})`
      : "va bien";
  return {
    titulo: `Subir presupuesto de "${datos.nombreCampana}"`,
    justificacion: `"${datos.nombreCampana}" ${desempeno}, pero tu meta va atrasada. Si le subimos 20% el presupuesto diario (de ${formatoCop(datos.presupuestoActual)} a ${formatoCop(datos.presupuestoNuevo)}), a este ritmo llegarías a ~${datos.proyeccionNueva} de ${datos.cantidadObjetivo}.`,
    impactoEsperado: `Más alcance diario para "${datos.nombreCampana}".`,
    costoEstimadoCop: null,
  };
}

export function textoCrearCreativos(datos: { nombreCampana: string; motivo: "costo" | "frecuencia" | "ambos" }): TextoPropuesta {
  const detalleMotivo =
    datos.motivo === "ambos"
      ? "el costo por resultado subió y la frecuencia con la que la misma persona ve el anuncio ya es alta"
      : datos.motivo === "frecuencia"
        ? "la frecuencia con la que la misma persona ve el anuncio ya es alta"
        : "el costo por resultado de los últimos días subió bastante respecto a los primeros días";

  return {
    titulo: `Refrescar los creativos de "${datos.nombreCampana}"`,
    justificacion: `"${datos.nombreCampana}" muestra señales de fatiga: ${detalleMotivo}. Nuevos creativos pueden revertir esta caída. La generación usa tu propia llave de OpenAI conectada en Integraciones, no tiene costo adicional en Quiubot.`,
    impactoEsperado: "Creativos nuevos listos para revisar antes de agregarlos a la campaña.",
    costoEstimadoCop: null,
  };
}
