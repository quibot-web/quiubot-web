// Arma el prompt que le pide el guion a la IA (paso 4, POST /api/video/guion).
// Separado del route.ts para poder leerlo y ajustarlo sin tocar la lógica
// de la ruta -- "deja la receta de cada objetivo en un archivo propio" del
// plan aplica también aquí: el texto fijo de reglas vive en un solo lugar.

import type { ObjetivoVideo } from "./guion.schema";
import type { RecetaObjetivo } from "./recetas/tipos";
import { COPY_QUE_VENDE, aplicaCopyQueVendeCompleto } from "./reglasCopy";

export interface PiezaDisponible {
  id: string;
  tipo: "imagen" | "video";
}

export interface EntradaGuion {
  objetivoId: ObjetivoVideo;
  receta: RecetaObjetivo;
  productoServicio: string;
  datosProducto: string | null;
  duracionS: number;
  piezas: PiezaDisponible[];
  usuarioCta: string | null;
  adnTitular: string | null;
  adnFraseCorta: string | null;
}

const REFERENCIA_ESCENAS = `TIPOS DE ESCENA Y SUS "params" (respeta los límites de caracteres):
- gancho_texto: {texto (<=60 car.), palabra_clave (palabra o frase corta DENTRO de texto), sticker? (<=14 car., ej. "NUEVO"), media_id? (solo si hay pieza y la receta permite gancho con producto)}
- problema_dato: {variante: "dato"|"pregunta". Si "dato": titulo (<=50), valor_desde?, valor_hasta? (números), prefijo?, sufijo?, etiqueta? (<=30). Si "pregunta": pregunta (<=60), sin cifras}
- producto_hero: {media_id (obligatorio, de las piezas disponibles), nombre (<=40), etiqueta? (<=20)}
- beneficios_lista: {titulo? (<=40), items: 2 o 3 strings (<=36 c/u)}
- lista_numerada: {titulo (<=45), items: EXACTAMENTE 3 strings (<=40 c/u)}
- revelacion_marca: {frase (<=50), mostrar_logo: true|false}
- oferta_precio: {precio (formato "$89.900"), precio_antes? (mismo formato), nota? (<=30)} -- SOLO si vino un precio real en "QUÉ DESTACAR"
- objecion_respuesta: {objecion (<=40), respuesta (<=40)} -- SOLO si la receta lo permite
- cta (siempre la última escena): {accion, texto_boton (<=28), mensajes? (0-3 strings <=32 c/u, SOLO si accion es "whatsapp"), usuario? (empieza con @, SOLO si accion es "seguir"), subtexto? (<=40)}

Cada escena también lleva: id (único, ej. "e1","e2"...), bloque (uno de: gancho, problema, producto, beneficio, valor, oferta, objecion, marca, cta -- el de la receta), duracion_s (entre 1.5 y 5), y subtitulo? {texto (<=80), palabra_clave} -- SOLO en la escena producto_hero (las demás ya tienen su texto grande en pantalla, no dupliques con un subtítulo).`;

function seccionReceta(entrada: EntradaGuion): string {
  const { receta } = entrada;
  const lineas = [
    `RECETA DEL OBJETIVO "${entrada.objetivoId}" (síguela, el código la valida después):`,
    `- Enfoque: ${receta.enfoque}`,
    `- Bloques permitidos, EN ESTE ORDEN (puedes saltarte los que no uses, nunca reordenar ni usar uno fuera de esta lista): ${receta.bloques.join(" -> ")}`,
    `- Entre 3 y 7 escenas en total. La primera es bloque "gancho" y dura 2.5s o menos, con movimiento y texto desde el primer cuadro (nada de presentación ni pantalla en negro). La última es tipo "cta".`,
    `- Duración total pedida: ${entrada.duracionS}s (la suma de duracion_s de las escenas no puede alejarse más de 2s de este número).`,
    `- Bucle de retención: ${receta.bucleTipico} bucle.indicador debe ser exactamente "${receta.indicadorBucle}". bucle.abre_en es el id de la primera escena; bucle.cierra_en es el id de la escena donde se cumple la promesa (antes o en el cta).`,
    `- El cta final usa accion "${receta.accionCta}", con un texto_boton parecido a "${receta.textoCtaSugerido}".`,
  ];
  if (receta.requiereUsuarioEnCta) {
    lineas.push(`- El cta DEBE incluir "usuario": "${entrada.usuarioCta}".`);
  } else {
    lineas.push(`- El cta NO debe incluir el campo "usuario".`);
  }
  if (receta.requiereRevelacionMarca) {
    lineas.push(`- Debe incluir una escena tipo "revelacion_marca".`);
  }
  if (!receta.permiteObjecionRespuesta) {
    lineas.push(`- No uses la escena "objecion_respuesta" (solo aplica al objetivo de volver a impactar).`);
  }
  if (receta.indicadorBucle === "contador") {
    lineas.push(`- Como bucle.indicador es "contador", la escena en bucle.cierra_en debe ser tipo "lista_numerada".`);
  }
  return lineas.join("\n");
}

function seccionPiezas(piezas: PiezaDisponible[]): string {
  if (piezas.length === 0) {
    return "PIEZAS DEL ÁLBUM: no se eligió ninguna -- no uses producto_hero ni el media_id del gancho. Para producto_hero usa un fondo de marca en su lugar (ya lo resuelve el código, no lo menciones en el guion).";
  }
  const lista = piezas.map((p) => `- ${p.id} (${p.tipo})`).join("\n");
  return `PIEZAS DISPONIBLES DEL ÁLBUM (usa el id EXACTO como media_id, nunca inventes uno ni pongas una URL):\n${lista}`;
}

export function construirPromptGuion(entrada: EntradaGuion, erroresPrevios?: string[]): string {
  const copy = aplicaCopyQueVendeCompleto(entrada.objetivoId)
    ? COPY_QUE_VENDE
    : `${COPY_QUE_VENDE.split("\n").slice(0, 1).join("\n")}\n(Para este objetivo el enfoque es VALOR, no venta: un consejo, un dato o una emoción del rubro de la marca. Nada de precios ni "compra ya". Igual aplican las frases prohibidas de más abajo.)`;

  const partes = [
    `Eres el guionista publicitario de Quiubot. Escribes el guion de un video de anuncio corto (formato 9:16, sin voz) para Meta Ads. Español colombiano, tuteo, frases cortas y directas.`,
    `Estructura obligatoria en toda escena: gancho (abre una pregunta, promesa o dato) -> bucle abierto -> desarrollo -> cierre del bucle -> cta. Nunca inventes precios, cifras, garantías ni testimonios que no vengan explícitos en "QUÉ DESTACAR" más abajo.`,
    copy,
    seccionReceta(entrada),
    `MARCA:\n- Titular del ADN: ${entrada.adnTitular || "(sin dato)"}\n- Frase corta de marca: ${entrada.adnFraseCorta || "(sin dato)"}`,
    `PRODUCTO O SERVICIO: ${entrada.productoServicio}`,
    `QUÉ DESTACAR (datos reales del negocio -- precio, envíos, garantía, diferenciales -- úsalos si aplican, es lo ÚNICO de donde puedes sacar cifras): ${entrada.datosProducto || "(nada adicional)"}`,
    seccionPiezas(entrada.piezas),
    REFERENCIA_ESCENAS,
    `Responde ÚNICAMENTE con este JSON, sin texto adicional ni backticks ni comentarios:\n{"bucle": {"texto": "...", "abre_en": "e1", "cierra_en": "eN", "indicador": "..."}, "escenas": [ {"id": "e1", "bloque": "...", "tipo": "...", "duracion_s": 0, "subtitulo": {...opcional...}, "params": {...}} , ... ]}`,
  ];

  if (erroresPrevios && erroresPrevios.length > 0) {
    partes.push(
      `El guion anterior NO pasó la validación. Corrige exactamente esto y vuelve a responder con el JSON completo:\n${erroresPrevios.map((e) => `- ${e}`).join("\n")}`
    );
  }

  return partes.join("\n\n");
}
