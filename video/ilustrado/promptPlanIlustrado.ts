// Prompt del plan ilustrado (fase 2): con la narración ya escrita y
// validada, la IA elige por cada frase qué escena del catálogo se ve y
// qué palabra dispara cada acción. Puro (lo prueba promptPlanIlustrado.test.ts).
import { catalogoKitTexto } from "./kit/promptKit";
import { textoVariedadParaPrompt, type HuellaVisual } from "./kit/variedad";
import { accionesDisponiblesTexto, MAX_PALABRAS_SIN_ACCION, MIN_PALABRAS_ENTRE_ISLAS, MIN_PALABRAS_POR_PANTALLA, type OpcionesDeHistoria } from "./motor/validarPlan";

// Conceptos frecuentes de un negocio -> la metáfora más cercana del
// catálogo actual (fase 2: solo las escenas del prototipo).
const METAFORAS = [
  "gastar plata, presupuesto, pérdidas, costo -> billetera (sale_moneda / se_cierra)",
  "ganancias, ventas que llegan, recuperar la inversión -> billetera (recibe_moneda / se_llena) o grafica (sube)",
  "público, a quién le hablas, segmentar, clientes ideales -> multitud (foco_barre, todos_tenues, se_iluminan)",
  "atención, scroll, que te vean o no, anuncios, contenido -> feed (aparece_anuncio, lo_miran, pasa_de_largo, desliza, se_detiene)",
  "calidad de la foto, mostrar el producto -> feed (foto_apagada -> foto_se_aclara)",
  "mensajes, atención al cliente, responder, cerrar ventas por chat -> chat (llega_mensaje, responde, se_vuelve_venta)",
  "esperar, demora, paciencia, clientes que se van -> reloj_cliente (reloj_acelera, cliente_se_va)",
  "crecimiento, resultados, mejora -> grafica (sube)",
  "seguir la cuenta, llamado a la acción -> perfil (aparece, toque_seguir)",
];

// conKit (visuales-v2, solo cuentas de REELS_ILUSTRADOS_EMAILS): la IA
// también puede armar lugares con el kit de escenas.
// historial: huellas de los últimos reels de la cuenta (variedad).
// opcionesDeHistoria: en una historia narrada, las frases de la opción A y
// de la opción B (cada una con su propia escena, ver validarPlan).
export function construirPromptPlanIlustrado(escenas: { id: string; narracion: string }[], erroresPrevios?: string[], opciones: { conKit?: boolean; historial?: HuellaVisual[]; opcionesDeHistoria?: OpcionesDeHistoria } = {}): string {
  const variedad = textoVariedadParaPrompt(opciones.historial ?? []);
  const frases = escenas
    .map((e) => {
      const palabras = e.narracion.trim().split(/\s+/).filter(Boolean);
      return `${e.id}: ${palabras.map((p, i) => `[${i}]${p}`).join(" ")}`;
    })
    .join("\n");
  return `Eres director de animación de reels ilustrados. La voz ya está escrita; tu trabajo es decidir QUÉ SE VE mientras se escucha cada frase, usando SOLO las escenas y acciones de este catálogo. Lo que se ve son objetos animados (un celular con su feed o su chat, una billetera, una multitud, un reloj con un cliente, una gráfica), nunca texto: el único texto en pantalla es el subtítulo, que ya existe.

CATÁLOGO (escena: acciones)
${accionesDisponiblesTexto()}

${opciones.conKit ? `${catalogoKitTexto()}

` : ""}${variedad ? `${variedad}

` : ""}METÁFORAS: si la frase habla de un concepto que no está literal en el catálogo, elige la metáfora más cercana y explícala en "metafora" (una línea, no se muestra):
${METAFORAS.map((m) => `- ${m}`).join("\n")}

NARRACIÓN (cada palabra con su número entre corchetes, por frase):
${frases}

REGLAS
1. Una entrada por frase, en el mismo orden, con su "escena_id".
2. Cada acción va amarrada a la palabra que la nombra o la provoca ("palabra" = el número entre corchetes de ESA frase). Ejemplo: en "se te va una moneda", sale_moneda va en "moneda".
3. La primera acción del reel va en la palabra 0 o 1 de la primera frase (movimiento desde el inicio).
4. Nunca más de ${MAX_PALABRAS_SIN_ACCION} palabras seguidas sin una acción (contando entre frases).
5. Dos acciones seguidas en lugares distintos (por ejemplo feed y billetera, o chat y reloj_cliente) van separadas al menos ${MIN_PALABRAS_ENTRE_ISLAS} palabras: la cámara viaja entre ellas. feed, publicacion, chat y perfil son el MISMO lugar (el celular).
6. Usa pocas escenas distintas (2 a 5 en todo el reel) y vuelve a las mismas: es un solo mundo con una cámara continua.
7. De 1 a 4 acciones por frase.
8. El celular muestra UNA pantalla a la vez (feed, publicacion, chat o perfil). Cuando cambias de pantalla, la nueva se queda al menos ${MIN_PALABRAS_POR_PANTALLA} palabras; no saltes entre pantallas a cada rato.
9. El perfil (aparece, toque_seguir) va SOLO en la última frase, que es el cierre, y después de toque_seguir no va ninguna otra acción.
10. Cada acción en su propia palabra: nunca dos acciones en la misma palabra.
11. Nunca inventes datos: las escenas no muestran precios, descuentos, reseñas, horarios ni promesas, y tú no escribes ningún texto para la pantalla. Solo eliges escena, acción y palabra.${
    opciones.opcionesDeHistoria
      ? `
12. DOS OPCIONES: la frase ${opciones.opcionesDeHistoria.a} es la opción A y la frase ${opciones.opcionesDeHistoria.b} es la opción B. Son dos caminos distintos y se tienen que VER distintos: cada una con su propia escena, sin repetir ninguna escena ni composición entre las dos. Que lo que se ve explique la diferencia. Por ejemplo: promocionar una publicación que ya existe = publicacion (aparece, suben_likes, toca_promocionar), sin chat (nadie escribe); un anuncio nuevo para que te escriban = feed.aparece_anuncio y después chat.llega_mensaje varias veces (el chat se llena).`
      : ""
  }

RESPONDE SOLO este JSON:
${
    opciones.conKit
      ? `{"composiciones":[ /* opcional: solo si usas el kit */ ],"frases":[{"escena_id":"e1","acciones":[{"escena":"feed","accion":"aparece_anuncio","palabra":1},{"escena":"k_salon","accion":"profesora.senala","palabra":6,"objetivo":"dibujo_nina"}],"metafora":"opcional"}]}`
      : `{"frases":[{"escena_id":"e1","acciones":[{"escena":"feed","accion":"aparece_anuncio","palabra":1}],"metafora":"opcional"}]}`
  }${
    erroresPrevios && erroresPrevios.length > 0 ? `\n\nTU RESPUESTA ANTERIOR TUVO ESTOS PROBLEMAS, CORRÍGELOS:\n${erroresPrevios.map((e) => `- ${e}`).join("\n")}` : ""
  }`;
}
