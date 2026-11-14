// Arma el prompt que le pide el guion orgánico a la IA (commit 4b,
// POST /api/contenido/[id]/guion). Mismo rol que video/promptGuion.ts
// para anuncios, separado para no arriesgar ese prompt ya en
// producción -- las reglas son distintas (valor, no venta; agrega
// caption/hashtags) aunque la estructura de salida se parezca.
import type { AnalisisPieza } from "../app/lib/analisisPieza";
import type { RecetaOrganicaId } from "./guion.schema";
import type { RecetaOrganica } from "./recetas/organico/tipos";
import { COPY_QUE_VENDE } from "./reglasCopy";
import type { PiezaDisponible } from "./promptGuion";

export interface EntradaGuionOrganico {
  recetaId: RecetaOrganicaId;
  receta: RecetaOrganica;
  duracionS: number;
  infoAdicionalMarca: string | null;
  adnTitular: string | null;
  adnFraseCorta: string | null;
  // Commit 4b.2: fotos/videos del álbum elegidos en "Agregar reel"
  // (hasta 3). Vacío si la pieza no eligió ninguna -- producto_en_uso
  // exige al menos una (ver RECETAS_QUE_EXIGEN_MEDIA en app/lib/contenido.ts).
  piezas: PiezaDisponible[];
  analisisPiezas: Record<string, AnalisisPieza>;
}

// Mismo truco que video/promptGuion.ts para los objetivos de valor: solo
// la parte de "prohibido"/"no inventar" de COPY QUE VENDE, nunca la
// parte de "escribe para que actúe ya" -- el contenido orgánico SIEMPRE
// es valor, nunca venta (ver la nota del plan, sección 1).
const COPY_SOLO_PROHIBIDO = `${COPY_QUE_VENDE.split("\n").slice(0, 1).join("\n")}\n(Este es contenido ORGÁNICO, no un anuncio: el enfoque es VALOR -- un consejo, un dato, una conversación o algo de la marca. Nunca pidas comprar, nunca menciones precios ni ofertas. Igual aplican las frases prohibidas de más abajo: nunca inventes datos ni los dejes en duda.)`;

const REFERENCIA_ESCENAS = `TIPOS DE ESCENA Y SUS "params" (respeta los límites de caracteres AL PIE DE LA LETRA -- el código los rechaza si se pasan, aunque sea por 1 carácter):
- gancho_texto: {texto (<=60 car.), palabra_clave (palabra o frase corta DENTRO de texto), sticker? (<=14 car.)}
- producto_hero: {media_id (obligatorio, de las piezas disponibles), nombre (<=40), etiqueta? (<=20), tratamiento (obligatorio -- ver TRATAMIENTOS)} -- SOLO si hay piezas disponibles y la receta lo permite (producto_en_uso)
- lista_numerada: {titulo (<=45), items: EXACTAMENTE 3 strings (<=40 c/u) -- siempre 3, ni 2 ni 4}
- beneficios_lista: {titulo? (<=40), items: 2 o 3 strings (<=36 c/u)}
- revelacion_marca: {frase (<=50), mostrar_logo: true|false}
- objecion_respuesta: {objecion (<=40), respuesta (<=40)} -- SOLO si la receta lo permite (mito_verdad)
- dos_opciones: {opcion_a (<=30), opcion_b (<=30)} -- SOLO en la receta pregunta_comunidad
- cta (siempre la última escena): {accion, texto_boton (<=28), usuario? (empieza con @, SOLO si accion es "seguir"), subtexto? (<=40), palabra_clave_comentario? (<=20, SOLO si accion es "comentar" -- la palabra que debe escribir quien comenta)}

Cada escena también lleva: id (único, ej. "e1","e2"...), bloque (uno de: gancho, producto, valor, beneficio, marca, objecion, cta -- el de la receta), duracion_s (un número entre 1.5 y 5, la del gancho además entre 1.5 y 2.5), y subtitulo? -- OPCIONAL y SOLO en producto_hero (las demás escenas ya tienen su propio texto grande en pantalla), y si lo usas es SIEMPRE UN OBJETO, NUNCA un string: {texto (<=80 car.), palabra_clave (palabra o frase corta DENTRO de texto, <=30 car.)}. Si no estás seguro, mejor omite el campo "subtitulo" por completo (no es obligatorio).

"bucle" (objeto aparte, no es una escena): {texto (<=60 car. -- es la frase corta que abre y recuerda el bucle, NUNCA una frase larga), abre_en (id de una escena real), cierra_en (id de una escena real, posterior a abre_en), indicador ("contador"|"espera_final"|"ninguno", el que pida la receta)}.

CAPTION Y HASHTAGS: "caption" hasta 2200 caracteres (el gancho en la primera línea). "hashtags": un array de ENTRE 3 Y 8 strings, cada uno <=40 caracteres, cada uno empezando con "#", SIN REPETIR ninguno (ni con mayúsculas distintas).

TRATAMIENTOS de una pieza del álbum (campo "tratamiento" de producto_hero) -- "tarjeta" | "celular" | "completa":
- "tarjeta": la imagen completa sin recortar, como una tarjeta flotante. Úsalo si la pieza YA tiene texto impreso (nunca se lo cortes).
- "celular": la imagen dentro de un marco de teléfono, como si fuera un post.
- "completa": pantalla completa recortada. SOLO si la pieza NO tiene texto impreso -- si tiene texto, el código RECHAZA el guion.`;

function seccionReceta(entrada: EntradaGuionOrganico): string {
  const { receta } = entrada;
  // Techo real de duración alcanzable con estas escenas: el gancho mide
  // máximo 2.5s y cada otra escena máximo 5s, y solo puede haber UNA
  // escena por cada vez que un bloque aparece en la lista de abajo (si
  // "valor" aparece una sola vez, es UNA escena de bloque "valor", no
  // dos). Se lo decimos explícito a la IA para que nunca intente sumar
  // una escena de más para llegar a la duración -- causa real de un
  // guion rechazado (dos escenas de bloque "valor" cuando la receta
  // solo permitía una).
  const techoAlcanzable = 2.5 + 5 * (receta.bloques.length - 1);
  const pisoAlcanzable = 1.5 * receta.bloques.length;
  const lineas = [
    `RECETA "${entrada.recetaId}" (síguela, el código la valida después):`,
    `- Enfoque: ${receta.enfoque}`,
    `- Bloques, EN ESTE ORDEN EXACTO, cada uno con UNA escena por cada vez que aparece en esta lista (ni una escena más, ni una de menos; nunca reordenar, nunca repetir un bloque que no esté repetido aquí): ${receta.bloques.join(" -> ")}. Eso da exactamente ${receta.bloques.length} escenas en total.`,
    `- La primera escena es bloque "gancho" y dura 2.5s o menos, con movimiento y texto desde el primer cuadro. La última es tipo "cta".`,
    `- Duración total pedida: ${entrada.duracionS}s -- la suma de duracion_s de TODAS las escenas no puede alejarse más de 2s de ese número (debe quedar entre ${(entrada.duracionS - 2).toFixed(1)}s y ${(entrada.duracionS + 2).toFixed(1)}s). Con las ${receta.bloques.length} escenas de esta receta, la suma real solo puede ir de ${pisoAlcanzable.toFixed(1)}s a ${techoAlcanzable.toFixed(1)}s -- AJUSTA la duracion_s de cada escena dentro de sus propios topes para acertar el número, NUNCA agregues una escena de más para alcanzarlo.`,
    `- Bucle de retención: ${receta.bucleTipico} bucle.indicador debe ser exactamente "${receta.indicadorBucle}".`,
    `- El cta final usa accion "${receta.accionCta}", con un texto_boton parecido a "${receta.textoCtaSugerido}".`,
  ];
  if (receta.requiereUsuarioEnCta) lineas.push(`- El cta DEBE incluir "usuario" (el @ de la cuenta).`);
  else lineas.push(`- El cta NO debe incluir el campo "usuario".`);
  if (receta.requiereRevelacionMarca) lineas.push(`- Debe incluir una escena tipo "revelacion_marca".`);
  if (!receta.permiteObjecionRespuesta) lineas.push(`- No uses la escena "objecion_respuesta".`);
  if (receta.indicadorBucle === "contador") {
    lineas.push(
      `- Como bucle.indicador es "contador", la escena en bucle.cierra_en debe ser tipo "lista_numerada", que SIEMPRE tiene exactamente 3 items -- si bucle.texto o cualquier otro texto menciona una cantidad ("3 consejos", "3 partes", etc.), tiene que decir 3, nunca otro número.`
    );
  }
  if (receta.ganchoUsaProductoDeFondo) lineas.push(`- Esta receta exige al menos una escena "producto_hero" con una de las piezas disponibles.`);
  return lineas.join("\n");
}

function seccionPiezas(piezas: PiezaDisponible[], analisisPiezas: Record<string, AnalisisPieza>): string {
  if (piezas.length === 0) {
    return "PIEZAS DEL ÁLBUM: no se eligió ninguna -- no uses producto_hero, ni pongas media_id en ninguna escena.";
  }
  const lista = piezas
    .map((p) => {
      const analisis = analisisPiezas[p.id];
      if (!analisis) return `- ${p.id} (${p.tipo}): sin analizar, trátala como si pudiera tener texto -- usa "tarjeta" o "celular".`;
      if (analisis.tiene_texto) {
        return `- ${p.id} (${p.tipo}): YA TIENE TEXTO impreso -- no repitas ese texto en el guion, y tratamiento SOLO puede ser "tarjeta" o "celular".`;
      }
      return `- ${p.id} (${p.tipo}): foto limpia, sin texto -- puede usar cualquier tratamiento, incluida "completa".`;
    })
    .join("\n");
  return `PIEZAS DISPONIBLES DEL ÁLBUM (usa el id EXACTO como media_id en producto_hero, nunca inventes uno ni pongas una URL):\n${lista}`;
}

export function construirPromptGuionOrganico(entrada: EntradaGuionOrganico, erroresPrevios?: string[]): string {
  const partes = [
    `Eres el guionista de contenido orgánico de Quiubot. Escribes el guion de un reel corto (formato 9:16, sin voz) para Instagram. Español colombiano, tuteo, frases cortas y directas.`,
    `Estructura obligatoria: gancho (abre una pregunta, promesa o dato) -> bucle abierto -> desarrollo -> cierre del bucle -> cta.`,
    COPY_SOLO_PROHIBIDO,
    seccionReceta(entrada),
    `MARCA:\n- Titular del ADN: ${entrada.adnTitular || "(sin dato)"}\n- Frase corta de marca: ${entrada.adnFraseCorta || "(sin dato)"}`,
    `INFO DE LA MARCA (datos generales del negocio, "Lo que deben saber" en Mi marca -- único dato real permitido además del rubro): ${entrada.infoAdicionalMarca || "(nada adicional)"}`,
    seccionPiezas(entrada.piezas, entrada.analisisPiezas),
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
