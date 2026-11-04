// Portado literal de generar_estrategia v5 (nodo "armar prompt reparación"
// y nodo "validar diversidad") -- ver docs/diseno/anexo_reglas_copy_y_cta.md.
// No existía como código reutilizable en este repo; vivía solo dentro del
// prompt de n8n.

import type { Escena } from "./guion.schema";

export const COPY_QUE_VENDE = `COPY QUE VENDE — REGLA OBLIGATORIA (tan importante como la estructura):
"No inventar datos" NO significa "escribir sin vender". Un anuncio existe para que la persona QUIERA el producto y actúe ya.
- Vende con beneficios reales: lo que el producto le permite hacer, lograr, sentir o ahorrar a la persona. Puedes usar los beneficios propios de la categoría del producto (lo que cualquier experto sabe que hace ese tipo de producto), sin inventar cifras exactas (potencia, medidas, duración, precios, descuentos) que no estén en los datos del negocio.
- Los datos comerciales del negocio (precio, envíos, garantía, combos, promociones, diferenciales) son verdad dicha por el dueño: úsalos siempre que existan en la entrada.
- Escribe con seguridad, como el dueño de un negocio que conoce y respalda lo que vende. Tono de vendedor experto y cercano, nunca de notario ni de abogado.
- PROHIBIDO: frases de descargo o de duda sobre la propia oferta, como "confirma que incluye", "te confirmamos precio y disponibilidad", "información comercial disponible", "antes de decidir", "antes de comprar", "verifica", "contenido exacto de la oferta", "no asumas", "sujeto a", "condiciones disponibles", "especificaciones disponibles".
- PROHIBIDO hablar de la imagen o el video como si fuera una pieza: "los equipos mostrados", "las herramientas mostradas", "opciones visibles", "visible en la pieza", "en la gráfica", "en la imagen". Habla del PRODUCTO, no de la foto.
- Si no tienes precio, NO lo conviertas en una duda: conviértelo en una invitación con valor ("Escríbenos y te cotizamos hoy", "Pregunta por el combo", "Te asesoramos para que te lleves el que tu trabajo necesita").
- La duda del cliente es un ángulo válido (objecion_respuesta), pero se RESUELVE con seguridad, no se amplifica.
- Si no hay urgencia ni prueba social reales, no las inventes y no las reemplaces con advertencias: compensa con un beneficio concreto, un gancho fuerte y un cta claro.
Estas frases de descargo se detectan automáticamente en código: un guion que las use se reescribe.`;

// Objetivos donde aplica la parte de "que actúe ya" de COPY QUE VENDE
// completa. En reconocimiento y seguidores solo aplica lo prohibido /
// no inventar (el enfoque ahí es valor, no venta) -- ver sección 1 del
// anexo.
const OBJETIVOS_VENTA = ["venta_directa_whatsapp", "venta_directa_web", "leads", "trafico_mensajes", "visitas_web", "retargeting"] as const;

export function aplicaCopyQueVendeCompleto(objetivoId: string): boolean {
  return (OBJETIVOS_VENTA as readonly string[]).includes(objetivoId);
}

type Descargo = [RegExp, string];

const DESCARGOS: Descargo[] = [
  [/confirm(a|ar|amos|e)\b[^.]{0,40}(incluye|precio|disponibilidad|especificacion|condicion)/, 'pide confirmar precio, disponibilidad o contenido'],
  [/informacion comercial/, 'dice "informacion comercial"'],
  [/antes de (decidir|comprar|tomar)/, 'dice "antes de decidir/comprar"'],
  [/\bverific(a|ar|amos|ues)\b/, 'pide verificar'],
  [/contenido exacto/, 'dice "contenido exacto"'],
  [/no asumas/, 'dice "no asumas"'],
  [/sujet[oa]s? a /, 'dice "sujeto a"'],
  [/(condiciones|especificaciones|informacion) disponibles?/, 'habla de informacion/condiciones "disponibles"'],
  [/(equipos?|herramientas?|productos?|opciones|elementos?) (mostrad|visible)/, 'habla de lo "mostrado" en la imagen'],
  [/\bvisibles?\b/, 'habla de lo "visible" en la imagen'],
  [/en la (pieza|grafica|imagen|foto)\b/, 'se refiere a la pieza o la imagen'],
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Recoge todo el texto visible de las escenas: subtitulo.texto y cada
// campo de texto (o lista de textos) de params -- genérico por
// Object.values en vez de un caso por tipo de escena, así no hay que
// tocar esto cada vez que se agregue un campo nuevo a una escena.
export function recopilarTextosEscenas(escenas: Pick<Escena, "subtitulo" | "params">[]): string[] {
  const textos: string[] = [];
  for (const escena of escenas) {
    if (escena.subtitulo?.texto) textos.push(escena.subtitulo.texto);
    for (const valor of Object.values(escena.params)) {
      if (typeof valor === "string") textos.push(valor);
      else if (Array.isArray(valor)) {
        for (const item of valor) {
          if (typeof item === "string") textos.push(item);
        }
      }
    }
  }
  return textos;
}

// Devuelve los motivos de rechazo (vacío si el copy pasa). Normaliza a
// minúsculas y sin tildes, igual que el original de n8n.
export function detectarFrasesDescargo(textos: string[]): string[] {
  const unido = normalizar(textos.join(" \n "));
  return DESCARGOS.filter(([re]) => re.test(unido)).map(([, motivo]) => motivo);
}
