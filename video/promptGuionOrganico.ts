// Arma el prompt que le pide el guion orgánico a la IA (commit 4b,
// POST /api/contenido/[id]/guion). Mismo rol que video/promptGuion.ts
// para anuncios, separado para no arriesgar ese prompt ya en
// producción -- las reglas son distintas (valor, no venta; agrega
// caption/hashtags) aunque la estructura de salida se parezca.
import type { RecetaOrganicaId } from "./guion.schema";
import type { RecetaOrganica } from "./recetas/organico/tipos";
import { COPY_QUE_VENDE } from "./reglasCopy";

export interface EntradaGuionOrganico {
  recetaId: RecetaOrganicaId;
  receta: RecetaOrganica;
  duracionS: number;
  infoAdicionalMarca: string | null;
  adnTitular: string | null;
  adnFraseCorta: string | null;
}

// Mismo truco que video/promptGuion.ts para los objetivos de valor: solo
// la parte de "prohibido"/"no inventar" de COPY QUE VENDE, nunca la
// parte de "escribe para que actúe ya" -- el contenido orgánico SIEMPRE
// es valor, nunca venta (ver la nota del plan, sección 1).
const COPY_SOLO_PROHIBIDO = `${COPY_QUE_VENDE.split("\n").slice(0, 1).join("\n")}\n(Este es contenido ORGÁNICO, no un anuncio: el enfoque es VALOR -- un consejo, un dato, una conversación o algo de la marca. Nunca pidas comprar, nunca menciones precios ni ofertas. Igual aplican las frases prohibidas de más abajo: nunca inventes datos ni los dejes en duda.)`;

const REFERENCIA_ESCENAS = `TIPOS DE ESCENA Y SUS "params" (respeta los límites de caracteres):
- gancho_texto: {texto (<=60 car.), palabra_clave (palabra o frase corta DENTRO de texto), sticker? (<=14 car.)}
- lista_numerada: {titulo (<=45), items: EXACTAMENTE 3 strings (<=40 c/u)}
- beneficios_lista: {titulo? (<=40), items: 2 o 3 strings (<=36 c/u)}
- revelacion_marca: {frase (<=50), mostrar_logo: true|false}
- objecion_respuesta: {objecion (<=40), respuesta (<=40)} -- SOLO si la receta lo permite (mito_verdad)
- dos_opciones: {opcion_a (<=30), opcion_b (<=30)} -- SOLO en la receta pregunta_comunidad
- cta (siempre la última escena): {accion, texto_boton (<=28), usuario? (empieza con @, SOLO si accion es "seguir"), subtexto? (<=40), palabra_clave_comentario? (<=20, SOLO si accion es "comentar" -- la palabra que debe escribir quien comenta)}

Cada escena también lleva: id (único, ej. "e1","e2"...), bloque (uno de: gancho, valor, marca, objecion, cta -- el de la receta), duracion_s (entre 1.5 y 5), y subtitulo? (opcional, casi nunca hace falta -- estas escenas ya tienen su propio texto grande en pantalla).

Esta Fase todavía no usa fotos del álbum ni producto_hero en el guion orgánico -- no uses ese tipo de escena.`;

function seccionReceta(entrada: EntradaGuionOrganico): string {
  const { receta } = entrada;
  const lineas = [
    `RECETA "${entrada.recetaId}" (síguela, el código la valida después):`,
    `- Enfoque: ${receta.enfoque}`,
    `- Bloques permitidos, EN ESTE ORDEN (puedes saltarte los que no uses, nunca reordenar ni usar uno fuera de esta lista): ${receta.bloques.join(" -> ")}`,
    `- Entre 3 y 7 escenas en total. La primera es bloque "gancho" y dura 2.5s o menos, con movimiento y texto desde el primer cuadro. La última es tipo "cta".`,
    `- Duración total pedida: ${entrada.duracionS}s (la suma de duracion_s de las escenas no puede alejarse más de 2s de este número).`,
    `- Bucle de retención: ${receta.bucleTipico} bucle.indicador debe ser exactamente "${receta.indicadorBucle}".`,
    `- El cta final usa accion "${receta.accionCta}", con un texto_boton parecido a "${receta.textoCtaSugerido}".`,
  ];
  if (receta.requiereUsuarioEnCta) lineas.push(`- El cta DEBE incluir "usuario" (el @ de la cuenta).`);
  else lineas.push(`- El cta NO debe incluir el campo "usuario".`);
  if (receta.requiereRevelacionMarca) lineas.push(`- Debe incluir una escena tipo "revelacion_marca".`);
  if (!receta.permiteObjecionRespuesta) lineas.push(`- No uses la escena "objecion_respuesta".`);
  if (receta.indicadorBucle === "contador") lineas.push(`- Como bucle.indicador es "contador", la escena en bucle.cierra_en debe ser tipo "lista_numerada".`);
  return lineas.join("\n");
}

export function construirPromptGuionOrganico(entrada: EntradaGuionOrganico, erroresPrevios?: string[]): string {
  const partes = [
    `Eres el guionista de contenido orgánico de Quiubot. Escribes el guion de un reel corto (formato 9:16, sin voz) para Instagram. Español colombiano, tuteo, frases cortas y directas.`,
    `Estructura obligatoria: gancho (abre una pregunta, promesa o dato) -> bucle abierto -> desarrollo -> cierre del bucle -> cta.`,
    COPY_SOLO_PROHIBIDO,
    seccionReceta(entrada),
    `MARCA:\n- Titular del ADN: ${entrada.adnTitular || "(sin dato)"}\n- Frase corta de marca: ${entrada.adnFraseCorta || "(sin dato)"}`,
    `INFO DE LA MARCA (datos generales del negocio, "Lo que deben saber" en Mi marca -- único dato real permitido además del rubro): ${entrada.infoAdicionalMarca || "(nada adicional)"}`,
    REFERENCIA_ESCENAS,
    `Además del guion, escribe el caption para Instagram: "caption" (máx. 2200 caracteres, el gancho en la primera línea) y "hashtags" (entre 3 y 8, en español, del rubro de la marca, cada uno empezando con #).`,
    `Responde ÚNICAMENTE con este JSON, sin texto adicional ni backticks ni comentarios:\n{"bucle": {"texto": "...", "abre_en": "e1", "cierra_en": "eN", "indicador": "..."}, "escenas": [ {"id": "e1", "bloque": "...", "tipo": "...", "duracion_s": 0, "params": {...}} , ... ], "caption": "...", "hashtags": ["#...", "#..."]}`,
  ];

  if (erroresPrevios && erroresPrevios.length > 0) {
    partes.push(
      `El guion anterior NO pasó la validación. Corrige exactamente esto y vuelve a responder con el JSON completo:\n${erroresPrevios.map((e) => `- ${e}`).join("\n")}`
    );
  }

  return partes.join("\n\n");
}
