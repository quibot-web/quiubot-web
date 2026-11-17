import type { BloqueGuion, Guion } from "../guion.schema";
import { contarPalabras } from "../guion.schema";
import { eventosDeVisual } from "./schema";

// Validación ESTRICTA de la Fase B v2.0 (edición desde el audio), a
// propósito separada de GuionSchema -- GuionSchema es la base
// compartida por las 6 recetas orgánicas ya en producción, que NO
// traen "narracion"/"visual" todavía (son campos opcionales ahí). Esta
// función es la que exige ambos, y solo la llama el pipeline nuevo
// (docs/diseno/plan_contenido_organico_fase_b_v2.md) -- nunca se mete
// en el superRefine de GuionSchema, para no romper retroactivamente
// los guiones/fixtures/tests de las recetas que todavía no la usan.
export type HallazgoEdicionAudio = { escenaId: string; mensaje: string };

export function validarEdicionDesdeAudio(escenas: Guion["escenas"]): HallazgoEdicionAudio[] {
  const hallazgos: HallazgoEdicionAudio[] = [];

  for (const escena of escenas) {
    if (!escena.narracion) {
      hallazgos.push({ escenaId: escena.id, mensaje: "Falta narracion -- la Fase B v2.0 exige voz en cada escena." });
      continue;
    }
    if (!escena.visual) {
      hallazgos.push({ escenaId: escena.id, mensaje: "Falta visual -- la Fase B v2.0 exige un visual con eventos en cada escena." });
      continue;
    }

    const totalPalabras = contarPalabras(escena.narracion);
    eventosDeVisual(escena.visual).forEach((evento, indiceEvento) => {
      if (evento.palabra < 0 || evento.palabra >= totalPalabras) {
        hallazgos.push({
          escenaId: escena.id,
          mensaje: `El evento ${indiceEvento} apunta a la palabra ${evento.palabra}, pero la narracion solo tiene ${totalPalabras} palabra(s).`,
        });
      }
    });
  }

  return hallazgos;
}

// Estructura específica de consejos_numerados CON AUDIO -- pedido
// explícito de Juan José (16 nov 2026) tras revisar el primer intento
// en staging: la IA metió los 3 consejos en UNA sola escena con un
// "contador" ("Uno: elige mensajes. Dos: usa fotos reales. Tres: pide
// escribirte por WhatsApp.") -- eso es DECIR, no MOSTRAR. Exige la
// misma estructura que el reel de referencia aprobado
// (video/fixtures/organico/referencia/ReelConsejosNumerados.tsx):
// gancho (celular_chat en 0) -> 3 escenas "valor", una por consejo,
// cada una concreta con su propio problema->arreglo -> "marca" cierra
// el bucle reusando el MISMO celular_chat del gancho (contador ya
// arriba) -> cta. Separada de validarEdicionDesdeAudio() (que es
// genérica, sin saber de recetas) porque esta sí es específica de UNA
// receta -- se llama aparte, solo para consejos_numerados.
const ESTRUCTURA_CONSEJOS_NUMERADOS: BloqueGuion[] = ["gancho", "valor", "valor", "valor", "marca", "cta"];
const MIN_PALABRAS_CONSEJO_CONCRETO = 5;

// Únicos tipos de 2 estados (problema->arreglo) de verdad -- boton_estado/
// cursor_clic quedan afuera a propósito (pedido explícito, 3ra
// revisión de staging): son UN estado con una acción, no muestran un
// "antes" real del consejo. celular_chat tampoco entra acá (es el
// visual del gancho/marca, no de un consejo puntual).
const TIPOS_VISUAL_VALOR = new Set(["anuncio_boton", "conexion_whatsapp", "respuesta_lenta", "contador"]);
// El cambio de estado debe caer, como mínimo, a este punto de la
// narracion (fracción del total de palabras) -- si cae muy al
// principio, el "problema" nunca llega a mostrarse de verdad.
const FRACCION_MINIMA_ANTES_DEL_CAMBIO = 0.3;

// Caso real (16 nov 2026, 2do round de revisión): la regla original
// contaba CUALQUIER palabra "uno/dos/tres/primero/segundo/tercero" en
// toda la narracion, sin importar si era un MARCADOR de enumeración o
// solo un número dentro del consejo -- "Segundo, verifica dos cosas:
// que la foto sea real..." (un solo consejo real, con "dos cosas"
// como cantidad) se rechazaba igual que "Uno: elige mensajes. Dos:
// usa fotos reales. Tres: ..." (3 consejos de verdad enumerados). Un
// ordinal (primero/segundo/tercero) SIEMPRE cuenta como 1 marcador
// (puede abrir legítimamente la escena, "Segundo, haz esto"); un
// número en letras (uno/dos/tres/cuatro) SOLO cuenta si de verdad
// actúa como encabezado de lista (seguido de ":" o "." -- "Uno:",
// "Dos."), nunca como cantidad suelta dentro de la frase ("dos
// cosas", "tres minutos"); "1." "2." "3." (sin el punto decimal de un
// número como "1.5") también cuentan. Más de 1 marcador en la misma
// narracion = varios consejos enumerados juntos.
const MARCADORES_ORDINALES = /\b(primero|segundo|tercero|cuarto)\b/gi;
const MARCADORES_NUMERO_ENCABEZADO = /\b(uno|dos|tres|cuatro)\s*[:.]/gi;
const MARCADORES_DIGITO_ENCABEZADO = /\b[1-4]\.(?!\d)/g;

function contarMarcadoresDeConsejo(narracion: string): number {
  const ordinales = narracion.match(MARCADORES_ORDINALES) ?? [];
  const numeros = narracion.match(MARCADORES_NUMERO_ENCABEZADO) ?? [];
  const digitos = narracion.match(MARCADORES_DIGITO_ENCABEZADO) ?? [];
  return ordinales.length + numeros.length + digitos.length;
}

export function validarEstructuraConsejosNumeradosAudio(escenas: Guion["escenas"]): HallazgoEdicionAudio[] {
  const hallazgos: HallazgoEdicionAudio[] = [];
  const bloques = escenas.map((e) => e.bloque);
  const estructuraCorrecta = escenas.length === ESTRUCTURA_CONSEJOS_NUMERADOS.length && bloques.every((b, i) => b === ESTRUCTURA_CONSEJOS_NUMERADOS[i]);

  if (!estructuraCorrecta) {
    hallazgos.push({
      escenaId: escenas[0]?.id ?? "?",
      mensaje: `consejos_numerados con audio exige exactamente ${ESTRUCTURA_CONSEJOS_NUMERADOS.length} escenas en este orden: ${ESTRUCTURA_CONSEJOS_NUMERADOS.join(" -> ")} (una escena por cada consejo -- NUNCA los 3 consejos juntos en una sola escena). Llegaron ${escenas.length}: ${bloques.join(" -> ") || "(ninguna)"}.`,
    });
    // Sin la forma correcta no tiene sentido validar contenido por
    // índice (gancho/marca podrían no existir en las posiciones 0/4).
    return hallazgos;
  }

  const [gancho, , , , marca] = escenas;
  if (gancho.visual?.tipo !== "celular_chat") {
    hallazgos.push({ escenaId: gancho.id, mensaje: `El gancho debe usar visual "celular_chat" (arranca en 0 mensajes) -- llegó "${gancho.visual?.tipo ?? "sin visual"}".` });
  } else {
    // Ronda J: corrige una confusión real de la ronda anterior -- "que
    // el gancho se quede en 0" no era sobre el AUDIO (eso ya arrancaba
    // en 0s), era sobre este VISUAL. Caso real que lo motivó: la
    // narración del gancho es literalmente "¿Cero mensajes aunque tus
    // anuncios ya están publicados?" y el guion real traía un evento
    // "numero_sube" DENTRO de esa misma escena -- el visual contradice
    // su propia narración (la promesa/resolución de "el número sube"
    // es de la escena "marca"/"cta", nunca del gancho, cuyo trabajo es
    // mostrar el problema crudo, sin tocar).
    const eventosProblematicos = gancho.visual.eventos.filter((e) => e.accion === "numero_sube" || e.accion === "notificacion_llega");
    if (eventosProblematicos.length > 0) {
      hallazgos.push({
        escenaId: gancho.id,
        mensaje: `El "celular_chat" del gancho debe quedarse congelado en 0 (sin eventos "numero_sube" ni "notificacion_llega") -- la narración del gancho presenta el problema tal cual, nunca lo resuelve. Esos eventos son de las escenas "marca"/"cta", donde sí se cumple la promesa. Quita los eventos de esta escena (eventos: []).`,
      });
    }
  }
  if (marca.visual?.tipo !== "celular_chat") {
    hallazgos.push({
      escenaId: marca.id,
      mensaje: `La escena "marca" cierra el bucle del gancho y debe reusar visual "celular_chat" (el MISMO celular del gancho, ahora con el contador ya arriba) -- llegó "${marca.visual?.tipo ?? "sin visual"}".`,
    });
  }

  for (const escena of escenas.slice(1, 4)) {
    const narracion = escena.narracion ?? "";
    const marcadores = contarMarcadoresDeConsejo(narracion);
    if (marcadores > 1) {
      hallazgos.push({
        escenaId: escena.id,
        // Incluye un ejemplo concreto de cómo corregirlo (pedido
        // explícito) -- para que el reintento no repita el mismo error
        // los 3 intentos: la IA necesita ver la FORMA correcta, no solo
        // que "está mal".
        mensaje: `La narracion "${narracion}" tiene ${marcadores} marcadores de consejo (ordinales como "primero/segundo/tercero", o enumeraciones como "uno:"/"1.") -- parece enumerar varios consejos en una sola escena. Cada escena "valor" es UN solo consejo: reescríbela con UNA sola acción, sin enumerar más de una (ej. "Responde cada mensaje en menos de un minuto." -- no "Primero responde rápido, segundo revisa el catálogo.").`,
      });
    }
    if (contarPalabras(narracion) < MIN_PALABRAS_CONSEJO_CONCRETO) {
      hallazgos.push({
        escenaId: escena.id,
        mensaje: `La narracion "${narracion}" es muy corta para ser un consejo concreto y entendible por sí solo (mínimo ${MIN_PALABRAS_CONSEJO_CONCRETO} palabras) -- escribe la acción completa, no un fragmento (ej. "Responde cada mensaje en menos de un minuto.", no "Responde rápido.").`,
      });
    }

    // Pedido explícito (16 nov 2026, 3ra revisión de staging): "cada
    // escena valor usa un visual de 2 estados (problema->arreglo), y
    // el cambio de estado está amarrado a la palabra donde se da la
    // solución -- ni botones sueltos ni contadores sin contexto". Caso
    // real que lo motivó: un botón "Meta: mensajes" sin antes/después,
    // un cursor sin nada que mostrara el problema, un "2" sin etiqueta
    // mientras la voz hablaba de fotos reales -- "decía, no mostraba".
    const visual = escena.visual;
    if (visual && !TIPOS_VISUAL_VALOR.has(visual.tipo)) {
      hallazgos.push({
        escenaId: escena.id,
        mensaje: `Cada escena "valor" muestra el consejo con un visual de 2 estados (problema->arreglo): ${[...TIPOS_VISUAL_VALOR].join(", ")} -- llegó "${visual.tipo}". Un botón o cursor sueltos no muestran el antes y el después del consejo, cámbialo por uno de esos tipos.`,
      });
    } else if (visual) {
      const totalPalabras = contarPalabras(narracion);
      // "contador" puede traer varios eventos ("sube" por cada paso) --
      // el que importa para este chequeo es el ÚLTIMO (el "arreglo",
      // el valor final); los otros 3 tipos son de un único evento.
      const cuadroCambioPalabra = Math.max(...eventosDeVisual(visual).map((e) => e.palabra));
      if (totalPalabras > 0 && cuadroCambioPalabra < Math.ceil(totalPalabras * FRACCION_MINIMA_ANTES_DEL_CAMBIO)) {
        hallazgos.push({
          escenaId: escena.id,
          mensaje: `El cambio de estado (palabra ${cuadroCambioPalabra} de ${totalPalabras}) pasa muy al principio de "${narracion}" -- no alcanza a mostrarse el problema antes del arreglo. Ponlo más cerca de donde la narracion da la solución, no en las primeras palabras.`,
        });
      }
    }
  }

  return hallazgos;
}
