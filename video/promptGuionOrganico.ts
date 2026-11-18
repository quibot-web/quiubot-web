// Arma el prompt que le pide el guion orgánico a la IA (commit 4b,
// POST /api/contenido/[id]/guion). Mismo rol que video/promptGuion.ts
// para anuncios, separado para no arriesgar ese prompt ya en
// producción -- las reglas son distintas (valor, no venta; agrega
// caption/hashtags) aunque la estructura de salida se parezca.
import type { AnalisisPieza } from "../app/lib/analisisPieza";
import type { GanchoTipoOrganico, RecetaOrganicaId } from "./guion.schema";
import type { RecetaOrganica } from "./recetas/organico/tipos";
import { COPY_QUE_VENDE } from "./reglasCopy";
import type { PiezaDisponible } from "./promptGuion";

// Resumen de un producto/servicio del catálogo (app/lib/productos.ts)
// -- solo los campos que describen QUÉ es, nunca más (ver seccionNegocio).
export interface ProductoResumenNegocio {
  nombre: string;
  tipo: "producto" | "servicio";
  destacar: string | null;
  precio_cop: number | null;
}

export interface EntradaGuionOrganico {
  recetaId: RecetaOrganicaId;
  receta: RecetaOrganica;
  duracionS: number;
  infoAdicionalMarca: string | null;
  adnTitular: string | null;
  adnFraseCorta: string | null;
  // Catálogo real del negocio (app/lib/productos.ts) -- junto con
  // infoAdicionalMarca, es la ÚNICA fuente permitida de "qué vende y a
  // quién" este negocio (ver seccionNegocio/hayContextoDeNegocioSuficiente
  // más abajo). Caso real que motivó esto: la IA asumió que "Quiubot"
  // era un chatbot por el nombre, cuando es una plataforma de
  // publicidad en Meta con un equipo de IA para pymes.
  productos: ProductoResumenNegocio[];
  // Tema puntual pedido para esta pieza (campo opcional en "Agregar
  // reel"/revisión, ej. "por qué tus anuncios no traen mensajes") --
  // si viene, el guion tiene que tratar ESE tema, no cualquier tema
  // genérico de la receta. Lo llenará el Director en el commit 7.
  tema: string | null;
  // Producto/servicio del catálogo elegido para ESTA pieza (columna
  // producto_id, "Agregar reel") -- distinto de "productos", que es el
  // catálogo entero como contexto del negocio. Antes nunca llegaba al
  // prompt (18 nov 2026): el reel se generaba igual con o sin producto.
  productoPieza: ProductoResumenNegocio | null;
  // Tipo de gancho ya decidido por el código al CREAR la pieza (rota
  // los 6 tipos dentro de la semana, ver elegirGanchoTipoMenosUsado en
  // app/lib/contenido.ts) -- la IA NO elige el tipo, solo escribe el
  // gancho en ese estilo. Pedido explícito: dejado a su criterio, el
  // modelo repetía el mismo tipo varias veces en la misma semana.
  ganchoTipoAsignado: GanchoTipoOrganico;
  // Commit 4b.2: fotos/videos del álbum elegidos en "Agregar reel"
  // (hasta 3). Vacío si la pieza no eligió ninguna -- producto_en_uso
  // exige al menos una (ver RECETAS_QUE_EXIGEN_MEDIA en app/lib/contenido.ts).
  piezas: PiezaDisponible[];
  analisisPiezas: Record<string, AnalisisPieza>;
}

// Umbral mínimo para considerar que info_adicional dice algo real (no
// una palabra suelta) -- si no hay ni eso ni un solo producto en el
// catálogo, no hay con qué saber qué vende el negocio: no se genera
// contenido adivinando. Ver también el aviso en /contenido (UI).
export const AVISO_SIN_CONTEXTO_NEGOCIO = "Completa Mi marca (qué vendes y a quién) para crear contenido.";

export function infoAdicionalEsSuficiente(infoAdicionalMarca: string | null): boolean {
  return (infoAdicionalMarca?.trim().length ?? 0) >= 15;
}

export function hayContextoDeNegocioSuficiente(infoAdicionalMarca: string | null, productos: ProductoResumenNegocio[]): boolean {
  return infoAdicionalEsSuficiente(infoAdicionalMarca) || productos.length > 0;
}

// Mismo truco que video/promptGuion.ts para los objetivos de valor: solo
// la parte de "prohibido"/"no inventar" de COPY QUE VENDE, nunca la
// parte de "escribe para que actúe ya" -- el contenido orgánico SIEMPRE
// es valor, nunca venta (ver la nota del plan, sección 1).
const COPY_SOLO_PROHIBIDO = `${COPY_QUE_VENDE.split("\n").slice(0, 1).join("\n")}\n(Este es contenido ORGÁNICO, no un anuncio: el enfoque es VALOR -- un consejo, un dato, una conversación o algo de la marca. Nunca pidas comprar, nunca menciones precios ni ofertas. Igual aplican las frases prohibidas de más abajo: nunca inventes datos ni los dejes en duda.)`;

// Caso real que motivó esta regla (revisión de calidad, nov 2026): un
// guion de producto_en_uso decía "una forma más clara" / "una ruta
// clara" en vez de algo específico -- pasaba el zod (son solo strings
// cortos) pero no decía nada real. Ninguna librería puede detectar
// "vaguedad" en general, así que esto detecta frases concretas ya
// vistas, no reemplaza la regla del prompt.
const REGLA_CONCRETO = `CONCRETO, NO ABSTRACTO: cada escena tiene que decir algo específico y útil -- una acción puntual, un ejemplo real, un paso concreto o un resultado medible. PROHIBIDAS las frases de relleno sin contenido real, como "una forma más clara", "una ruta clara", "descubre más", "la mejor opción", "la solución ideal", "experiencia única". Si no podrías señalar con el dedo lo que esa frase describe, no la escribas.`;

const GANCHO_TIPOS_DESC: Record<GanchoTipoOrganico, string> = {
  pregunta: "una pregunta directa que el espectador ya se está haciendo",
  dato_sorprendente: "un dato o hecho que sorprende, sin inventar cifras -- solo si es real (viene de QUÉ HACE ESTE NEGOCIO o es conocimiento general del rubro)",
  error_comun: "un error común que comete la gente en este rubro",
  afirmacion_fuerte: "una afirmación tajante y directa, sin signo de pregunta",
  antes_despues: "el contraste entre un antes incómodo y un después mejor",
  nadie_te_dice_que: 'un secreto o algo que "nadie te dice" sobre el tema',
};

function seccionGancho(asignado: GanchoTipoOrganico): string {
  return `TIPO DE GANCHO ASIGNADO PARA ESTA PIEZA (ya decidido por el código para que varíe a lo largo de la semana -- no lo cambies ni elijas otro): el gancho tiene que ser de tipo "${asignado}" -- ${GANCHO_TIPOS_DESC[asignado]}. Escribe el gancho en ese estilo.`;
}

function seccionNegocio(infoAdicionalMarca: string | null, productos: ProductoResumenNegocio[]): string {
  const lineaProductos =
    productos.length > 0
      ? productos
          .map((p) => {
            const precio = p.precio_cop ? ` ($${p.precio_cop.toLocaleString("es-CO")})` : "";
            const destacar = p.destacar ? ` -- ${p.destacar}` : "";
            return `- ${p.nombre} (${p.tipo})${precio}${destacar}`;
          })
          .join("\n")
      : "(sin productos/servicios cargados en el catálogo)";

  return [
    `QUÉ HACE ESTE NEGOCIO -- ÚNICA fuente real de qué vende y a quién le vende. PROHIBIDO deducir, inventar, ampliar o contradecir esto: NUNCA asumas el rubro, el público o qué hace el negocio por el nombre de la marca, el logo o el estilo visual (caso real: no asumas que una marca llamada "Quiubot" es un chatbot solo por el nombre -- Quiubot es una plataforma de publicidad en Meta con un equipo de IA para pymes, y eso se sabe por este bloque, nunca por el nombre). Si un dato no aparece acá, no existe para este guion.`,
    `Descripción del negocio ("Lo que deben saber" en Mi marca): ${infoAdicionalMarca || "(sin descripción)"}`,
    `Catálogo de productos/servicios activos:\n${lineaProductos}`,
  ].join("\n");
}

const REFERENCIA_ESCENAS = `TIPOS DE ESCENA Y SUS "params" (respeta los límites de caracteres AL PIE DE LA LETRA -- el código los rechaza si se pasan, aunque sea por 1 carácter):
- gancho_texto: {texto (<=60 car.), palabra_clave (palabra o frase corta DENTRO de texto), sticker? (<=14 car.)}
- producto_hero: {media_id (obligatorio, de las piezas disponibles), nombre (<=40), etiqueta? (<=20), tratamiento (obligatorio -- ver TRATAMIENTOS)} -- SOLO si hay piezas disponibles y la receta lo permite (producto_en_uso)
- lista_numerada: {titulo (<=45), items: EXACTAMENTE 3 strings (<=40 c/u) -- siempre 3, ni 2 ni 4. El video YA numera cada item con un círculo (1, 2, 3) -- NUNCA antepongas tú un número o algo como "1/3" al texto del item (queda numerado dos veces), escribe directo el contenido: "Desconéctala antes de revisarla", nunca "1/3 Desconéctala antes de revisarla".}
- beneficios_lista: {titulo? (<=40), items: 2 o 3 strings (<=36 c/u)}
- revelacion_marca: {frase (<=50), mostrar_logo: true|false}
- objecion_respuesta: {objecion (<=40), respuesta (<=40)} -- SOLO si la receta lo permite (mito_verdad)
- dos_opciones: {opcion_a (<=30), opcion_b (<=30)} -- SOLO en la receta pregunta_comunidad
- cta (siempre la última escena): {accion, texto_boton (<=28), usuario? (empieza con @, SOLO si accion es "seguir"), subtexto? (<=40), palabra_clave_comentario? (<=20, SOLO si accion es "comentar" -- la palabra que debe escribir quien comenta)}

Cada escena también lleva: id (único, ej. "e1","e2"...), bloque (uno de: gancho, producto, valor, beneficio, marca, objecion, cta -- el de la receta), duracion_s (un número entre 1.5 y 5, la del gancho además entre 1.5 y 2.5), y subtitulo? -- OPCIONAL y SOLO en producto_hero (las demás escenas ya tienen su propio texto grande en pantalla), y si lo usas es SIEMPRE UN OBJETO, NUNCA un string: {texto (<=80 car.), palabra_clave (palabra o frase corta DENTRO de texto, <=30 car.)}. Si no estás seguro, mejor omite el campo "subtitulo" por completo (no es obligatorio).

"bucle" (objeto aparte, no es una escena): {texto (<=32 car. -- es la frase corta que abre y recuerda el bucle, NUNCA una frase larga: va en un chip de una sola línea sobre el video), abre_en (id de una escena real), cierra_en (id de una escena real, posterior a abre_en), indicador ("contador"|"espera_final"|"ninguno", el que pida la receta)}.

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
  if (entrada.recetaId === "mito_verdad") {
    lineas.push(
      `- La respuesta de cada "objecion_respuesta" tiene que ser FIRME y enseñar la verdad con seguridad -- PROHIBIDO sonar dudoso: nunca uses "no necesariamente", "depende", "puede que" ni nada parecido. Afirma la verdad tal cual, sin matices.`
    );
  }
  if (entrada.recetaId === "producto_en_uso") {
    lineas.push(
      `- Esta receta tiene que mostrar el PASO A PASO real de cómo se usa el producto/servicio (al menos 2 momentos concretos del uso) y terminar en el RESULTADO concreto que da -- usa SOLO lo que está en "QUÉ HACE ESTE NEGOCIO" (descripción + catálogo), nunca inventes un uso, una función o un resultado que no esté ahí.`
    );
  }
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

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// puntos 1 y 6) -- SOLO para el arnés de prueba del único reel
// automático (consejos_numerados/Quiubot), nunca para el flujo de
// siempre (construirPromptGuionOrganico de arriba sigue intacto, las
// 6 recetas en producción no llevan voz). Reusa las mismas secciones
// privadas de este archivo (negocio, receta, gancho, piezas,
// REFERENCIA_ESCENAS) -- solo cambia el encabezado, agrega la sección
// de narración/visual, y pide esos 2 campos en el JSON de salida.
const EVENTOS_POR_VISUAL = `TIPOS DE VISUAL (elige UNO por escena, el que mejor "muestre" la idea en vez de solo decirla) y su "eventos" -- cada evento tiene "palabra": el ÍNDICE (empieza en 0) de una palabra DENTRO de la narración de ESA MISMA escena (nunca un segundo, nunca un índice de otra escena -- si la narración de esta escena tiene 10 palabras, los índices válidos son 0 a 9), y "accion", restringida a las de cada tipo. Los eventos deben repartirse a lo largo de TODA la narración (no todos al principio) -- el visual cambia cada 1-2 segundos, nunca se queda estático toda la escena:
- celular_chat: {"tipo":"celular_chat","eventos":[{"palabra":N,"accion":"notificacion_llega"}|{"palabra":N,"accion":"numero_sube"}, ...]} (1 a 6 eventos) -- celular con notificaciones/mensajes llegando y un número grande que sube. Úsalo SOLO en el gancho y en la escena "marca" (abre y cierra el bucle con el mismo celular, nunca en escenas de consejo).
- boton_estado: {"tipo":"boton_estado","texto":"<=28 car.","texto_activo":"<=28 car.","eventos":[{"palabra":N,"accion":"aparece"},{"palabra":N,"accion":"clic"|"cambia_estado"}, ...]} (1 a 4 eventos) -- botón que cambia de texto/estado. Úsalo SOLO en el cta (ej. "Seguir" -> "Siguiendo ✓"), nunca en escenas de consejo (es de 1 estado, no muestra un antes/después real).
- cursor_clic: {"tipo":"cursor_clic","texto_boton":"<=28 car.","eventos":[{"palabra":N,"accion":"aparece"},{"palabra":N,"accion":"clic"}]} -- un botón con un cursor que lo clickea. Úsalo SOLO en el cta, nunca en escenas de consejo (mismo motivo que boton_estado).

Para escenas "valor" (una por consejo) usa SIEMPRE uno de estos 4, los únicos de 2 estados (problema->arreglo) -- el "antes" se ve hasta el evento, el "después" desde ahí:
- anuncio_boton: {"tipo":"anuncio_boton","eventos":[{"palabra":N,"accion":"cambia_estado"}]} (exactamente 1 evento) -- antes: un anuncio simulado SIN botón de contacto; después: aparece el botón y un cursor hace clic. Para el consejo "pon un botón de contacto en tu anuncio".
- conexion_whatsapp: {"tipo":"conexion_whatsapp","eventos":[{"palabra":N,"accion":"cambia_estado"}]} (exactamente 1 evento) -- antes: la línea entre el anuncio y WhatsApp está cortada (✗); después: se conecta y el mensaje llega al celular. Para el consejo "conecta tu anuncio a WhatsApp".
- respuesta_lenta: {"tipo":"respuesta_lenta","eventos":[{"palabra":N,"accion":"cambia_estado"}]} (exactamente 1 evento) -- antes: "Visto" + un reloj corriendo sin responder; después: respuesta inmediata y el cliente confirma. Para el consejo "responde rápido".
- contador: {"tipo":"contador","desde":0,"hasta":N (entero positivo, SIEMPRE ilustrativo -- ej. cuántos pasos/trucos hay en la lista -- NUNCA una cifra de resultado real de Quiubot),"etiqueta":"<=28 car., dice QUÉ cuenta (ej. 'mensajes nuevos', 'fotos revisadas') -- un número SOLO, sin etiqueta, no muestra nada","eventos":[{"palabra":N,"accion":"sube"}, ...]} (1 a 4 eventos) -- número grande que sube de "desde" a "hasta", con su etiqueta. Para un consejo que se mide con una cifra ilustrativa.

En los 4 de arriba, la palabra del evento (o la del ÚLTIMO evento en "contador") tiene que caer DESPUÉS de al menos el primer 30% de la narración de esa escena -- si cae en las primeras palabras, el "antes" del consejo nunca llega a verse.`;

const SECCION_NARRACION_Y_VISUAL = `NARRACIÓN Y VISUAL POR ESCENA (edición desde el audio -- este reel SÍ lleva voz): cada escena, ADEMÁS de sus "params" de siempre, lleva dos campos nuevos:
- "narracion": el texto que se narra en VOZ (distinto del texto grande en pantalla -- es lo que se ESCUCHA). Entre 7 y 16 palabras por escena (unos 3 a 6 segundos hablados a ritmo natural), frases cortas, UNA idea por escena. Nunca dígitos (números en letras: "tres", nunca "3"). El gancho (primera escena) tiene que tener su palabra más fuerte en la PRIMERA palabra -- nunca un arranque lento tipo "en Quiubot...".
- "visual": el visual que ACOMPAÑA esa narración (ver tipos abajo) -- elige el que mejor la MUESTRE en vez de solo decirla.

${EVENTOS_POR_VISUAL}`;

// Caso real (16 nov 2026, revisión de staging): con la receta de
// siempre (gancho -> valor -> marca -> cta, 4 escenas, "valor" es UNA
// lista_numerada con los 3 consejos como texto), la IA metió los 3
// consejos de voz en esa misma escena ("Uno: elige mensajes. Dos: usa
// fotos reales. Tres: pide escribirte por WhatsApp.") con un visual
// "contador" -- DECIR, no MOSTRAR. La estructura real que funciona (la
// del reel de referencia aprobado,
// video/fixtures/organico/referencia/ReelConsejosNumerados.tsx) necesita
// una escena "valor" POR CADA consejo -- 6 escenas en total, no 4.
// recetaParaPromptConAudio() expande receta.bloques SOLO para armar
// este prompt (seccionReceta ya sabe calcular "cuántas escenas" y el
// rango de duración alcanzable a partir de esa lista, sin que haga
// falta repetir esa lógica acá) -- la receta real en
// video/recetas/organico/consejosNumerados.ts queda intacta, la usan
// las 6 recetas de siempre sin voz.
export function recetaParaPromptConAudio(entrada: EntradaGuionOrganico): RecetaOrganica {
  if (entrada.recetaId === "consejos_numerados") {
    return { ...entrada.receta, bloques: ["gancho", "valor", "valor", "valor", "marca", "cta"] };
  }
  return entrada.receta;
}

const ESTRUCTURA_CONSEJOS_NUMERADOS_AUDIO = `ESTRUCTURA OBLIGATORIA PARA "consejos_numerados" CON VOZ -- EXACTAMENTE 6 escenas, en este orden (nunca menos, nunca los 3 consejos juntos en una sola escena):
1. "gancho": visual "celular_chat", congelado en 0 -- "eventos": SIEMPRE un array vacío ([]), NUNCA "numero_sube" ni "notificacion_llega" en esta escena. El gancho presenta el problema tal cual, sin resolverlo todavía (caso real que se rechazó: la narración decía "¿Cero mensajes...?" y el visual igual subía el contador en la misma escena -- se contradice a sí mismo). Esos 2 eventos son exclusivos de la escena "marca" (punto 5), donde sí se cumple la promesa. La narracion del gancho debe ser CORTA -- máximo 10-12 palabras (unos 3 segundos hablados), la frase más fuerte posible, nunca un gancho largo que tarda en enganchar.
2, 3, 4. TRES escenas "valor", UNA POR CADA CONSEJO, y los 3 consejos deben atacar 3 PROBLEMAS DISTINTOS (nunca 2 consejos sobre lo mismo con otras palabras -- ej. "pon WhatsApp como botón" y "conecta el anuncio a WhatsApp" son el MISMO problema, eso cuenta como repetido aunque la frase suene distinta). Cada una:
   - Es UN solo consejo, concreto y accionable, en una frase COMPLETA (ej. "Responde cada mensaje en menos de un minuto" -- nunca un fragmento vago como "elige mensajes" o "sé más rápido" que no se entiende por sí solo).
   - Preferible (no obligatorio, pero evítalo si puedes): UNA sola acción, no varias cosas que verificar o revisar a la vez -- mejor "Responde cada mensaje en menos de un minuto" que "Verifica que respondas rápido y que uses fotos reales" (eso mezcla 2 acciones en una).
   - Tiene su propio problema->arreglo visual: SIEMPRE uno de los 4 de 2 estados (anuncio_boton, conexion_whatsapp, respuesta_lenta o contador -- ver arriba), el que mejor MUESTRE ese consejo puntual, nunca el mismo tipo en las 3, y NUNCA boton_estado/cursor_clic/celular_chat acá (esos son de 1 estado o son del gancho/marca/cta, no muestran un antes->después del consejo).
5. "marca": CIERRA EL BUCLE -- vuelve a visual "celular_chat", el MISMO tipo que el gancho (nunca otro), ahora con eventos que suben el contador (el resultado real de aplicar los 3 consejos).
6. "cta": visual "boton_estado" o "cursor_clic" (nunca celular_chat ni los 4 de 2 estados -- esos quedan solo para gancho/marca/consejos). El evento "clic"/"cambia_estado" debe caer como máximo a la MITAD de la narracion de esta escena (nunca en la última palabra) -- "Siguiendo ✓" necesita tiempo visible en pantalla antes de que termine la escena.`;

// EJE DEL REEL (18 nov 2026, caso real: los reels consejos_numerados
// salían con los mismos 3 consejos -- botón de contacto, conexión a
// WhatsApp, respuesta rápida -- sin importar el tema). El tema pedido y
// el producto de la pieza van ARRIBA de todo y se dicen como eje, no
// como un dato más; y los consejos se deciden ANTES que los visuales
// (el visual se elige para mostrar el consejo, nunca al revés).
export function seccionEjeDelReel(entrada: Pick<EntradaGuionOrganico, "tema" | "productoPieza">): string {
  const lineas: string[] = ["EJE DEL REEL (lo más importante de este guion -- todo el reel gira alrededor de esto):"];
  const tema = entrada.tema?.trim();
  const producto = entrada.productoPieza;
  if (tema) {
    lineas.push(
      `- TEMA PEDIDO PARA ESTA PIEZA: "${tema}". El gancho, cada consejo y el cierre son sobre ESTE tema y nada más. Ejemplo de cómo se aplica: si el tema fuera "fotos de producto", los consejos serían sobre fotos (luz, fondo, mostrar el producto en uso), nunca sobre botones, WhatsApp o tiempos de respuesta.`
    );
  }
  if (producto) {
    const precio = producto.precio_cop ? ` ($${producto.precio_cop.toLocaleString("es-CO")})` : "";
    const destacar = producto.destacar ? ` -- lo que lo hace especial: ${producto.destacar}` : "";
    const clase = producto.tipo === "servicio" ? "servicio" : "producto";
    lineas.push(
      `- ${clase.toUpperCase()} DE ESTA PIEZA: ${producto.nombre}${precio}${destacar}. ${tema ? "Los consejos se aplican a este" : "El reel gira alrededor de este"} ${clase} (cómo elegirlo, usarlo, cuidarlo o sacarle provecho), sin volverlo un anuncio de venta.`
    );
  }
  if (!tema && !producto) {
    lineas.push(
      "- Esta pieza no trae tema ni producto: elige UN tema concreto del rubro real de este negocio (de su información y su catálogo, arriba), y que los consejos salgan de ese tema. Nunca un tema genérico de marketing que serviría para cualquier negocio."
    );
  }
  lineas.push(
    "- ORDEN AL ESCRIBIR: primero decide los consejos a partir del eje; DESPUÉS, para cada consejo, elige el visual que mejor lo muestre. Nunca elijas un consejo porque calza con un visual disponible."
  );
  return lineas.join("\n");
}

export function construirPromptGuionOrganicoConAudio(entrada: EntradaGuionOrganico, erroresPrevios?: string[]): string {
  const partes = [
    `Eres el guionista de contenido orgánico de Quiubot. Escribes el guion de un reel corto (formato 9:16, CON VOZ -- se narra en audio real, no es un reel mudo) para Instagram. Español colombiano, tuteo, frases cortas y directas.`,
    `Estructura obligatoria: gancho (abre una pregunta, promesa o dato) -> bucle abierto -> desarrollo -> cierre del bucle -> cta.`,
    COPY_SOLO_PROHIBIDO,
    REGLA_CONCRETO,
    seccionNegocio(entrada.infoAdicionalMarca, entrada.productos),
    seccionEjeDelReel(entrada),
    seccionReceta({ ...entrada, receta: recetaParaPromptConAudio(entrada) }),
    entrada.recetaId === "consejos_numerados" ? ESTRUCTURA_CONSEJOS_NUMERADOS_AUDIO : null,
    seccionGancho(entrada.ganchoTipoAsignado),
    `VOZ DE MARCA (tono y estilo, NO son datos del negocio):\n- Titular del ADN: ${entrada.adnTitular || "(sin dato)"}\n- Frase corta de marca: ${entrada.adnFraseCorta || "(sin dato)"}`,
    seccionPiezas(entrada.piezas, entrada.analisisPiezas),
    REFERENCIA_ESCENAS,
    SECCION_NARRACION_Y_VISUAL,
    `Además del guion, escribe el caption para Instagram: "caption" (máx. 2200 caracteres, el gancho en la primera línea) y "hashtags" (entre 3 y 8, en español, del rubro real de este negocio -- el de QUÉ HACE ESTE NEGOCIO, nunca el que creas por el nombre -- cada uno empezando con #).`,
    `Responde ÚNICAMENTE con este JSON, sin texto adicional ni backticks ni comentarios (sin el campo "gancho_tipo" -- ya está decidido). Cada escena lleva "narracion" y "visual" ADEMÁS de "id","bloque","tipo","duracion_s","params":\n{"bucle": {"texto": "...", "abre_en": "e1", "cierra_en": "eN", "indicador": "..."}, "escenas": [ {"id": "e1", "bloque": "...", "tipo": "...", "duracion_s": 0, "params": {...}, "narracion": "...", "visual": {"tipo": "...", "eventos": [...]}} , ... ], "caption": "...", "hashtags": ["#...", "#..."]}`,
  ].filter((parte): parte is string => !!parte);

  if (erroresPrevios && erroresPrevios.length > 0) {
    partes.push(
      `El guion anterior NO pasó la validación. Corrige exactamente esto y vuelve a responder con el JSON completo:\n${erroresPrevios.map((e) => `- ${e}`).join("\n")}`
    );
  }

  return partes.join("\n\n");
}

export function construirPromptGuionOrganico(entrada: EntradaGuionOrganico, erroresPrevios?: string[]): string {
  const partes = [
    `Eres el guionista de contenido orgánico de Quiubot. Escribes el guion de un reel corto (formato 9:16, sin voz) para Instagram. Español colombiano, tuteo, frases cortas y directas.`,
    `Estructura obligatoria: gancho (abre una pregunta, promesa o dato) -> bucle abierto -> desarrollo -> cierre del bucle -> cta.`,
    COPY_SOLO_PROHIBIDO,
    REGLA_CONCRETO,
    seccionNegocio(entrada.infoAdicionalMarca, entrada.productos),
    entrada.tema ? `TEMA PEDIDO PARA ESTA PIEZA (tienes que tratar justo esto, no cambies de tema): "${entrada.tema}"` : null,
    seccionReceta(entrada),
    seccionGancho(entrada.ganchoTipoAsignado),
    `VOZ DE MARCA (tono y estilo, NO son datos del negocio):\n- Titular del ADN: ${entrada.adnTitular || "(sin dato)"}\n- Frase corta de marca: ${entrada.adnFraseCorta || "(sin dato)"}`,
    seccionPiezas(entrada.piezas, entrada.analisisPiezas),
    REFERENCIA_ESCENAS,
    `Además del guion, escribe el caption para Instagram: "caption" (máx. 2200 caracteres, el gancho en la primera línea) y "hashtags" (entre 3 y 8, en español, del rubro real de este negocio -- el de QUÉ HACE ESTE NEGOCIO, nunca el que creas por el nombre -- cada uno empezando con #).`,
    `Responde ÚNICAMENTE con este JSON, sin texto adicional ni backticks ni comentarios (sin el campo "gancho_tipo" -- ya está decidido, no hace falta que lo repitas):\n{"bucle": {"texto": "...", "abre_en": "e1", "cierra_en": "eN", "indicador": "..."}, "escenas": [ {"id": "e1", "bloque": "...", "tipo": "...", "duracion_s": 0, "params": {...}} , ... ], "caption": "...", "hashtags": ["#...", "#..."]}`,
  ].filter((parte): parte is string => !!parte);

  if (erroresPrevios && erroresPrevios.length > 0) {
    partes.push(
      `El guion anterior NO pasó la validación. Corrige exactamente esto y vuelve a responder con el JSON completo:\n${erroresPrevios.map((e) => `- ${e}`).join("\n")}`
    );
  }

  return partes.join("\n\n");
}
