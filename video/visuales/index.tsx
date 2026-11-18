import { AbsoluteFill, spring } from "remotion";
import { respiracion, type TemaGuion } from "../tema";
import type { BloqueGuion } from "../guion.schema";
import type { Visual } from "./schema";
import { CelularChat } from "./CelularChat";
import { CursorClicEventos } from "./CursorClicEventos";
import { BotonEstado } from "./BotonEstado";
import { ContadorGigante, valorContadorEnFrame } from "./Contador";
import { TarjetaSimple } from "./TarjetaSimple";
import { AnuncioBotonVisual } from "./AnuncioBotonVisual";
import { ConexionWhatsappVisual } from "./ConexionWhatsappVisual";
import { RespuestaLentaVisual } from "./RespuestaLentaVisual";
import { ComparacionVisual } from "./ComparacionVisual";
import { IconoPalabraVisual } from "./IconoPalabraVisual";
import { ChecklistVisual } from "./ChecklistVisual";
import { ComparacionFotoVisual } from "./ComparacionFotoVisual";
import type { MediosResueltos } from "../escenas/tipos";
import { COLOR_ALERTA, COLOR_EXITO_BLOQUE } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 6). Dispatcher real -- análogo a video/escenas/index.tsx
// (renderizarEscena), pero para "visual" en vez de la escena
// completa: traduce visual.eventos (índices de palabra) a los
// cuadros/props concretos que cada componente promovido ya sabía
// animar (CelularChat, Contador, BotonEstado no necesitaron cambiar
// nada -- ya recibían frame/progreso/activo calculados por el
// caller; solo CursorClicGenerico se adaptó a CursorClicEventos
// porque calculaba su propio cuadroClic como 60% de una duración
// fija que ya no existe).
//
// Tipo local (no importado de app/lib/videoOrganico/generarVoz.ts) a
// propósito: ese archivo usa "server-only" y el SDK de Cloudinary --
// importarlo acá metería ese código Node-only al bundle de
// @remotion/web-renderer/Studio, que corre en el navegador. Mismo
// shape, cero acoplamiento real.
export type PalabraConTiempoVisual = { texto: string; inicio_s: number; fin_s: number };

export type ContextoVisual = {
  tema: TemaGuion;
  bloque: BloqueGuion;
  frame: number;
  fps: number;
  // Tiempos reales (segundos, absolutos en la narración completa) de
  // CADA palabra de la narración de ESTA escena, en orden -- mismo
  // array que devuelve alinearPalabras() en palabrasPorEscena.
  palabras: PalabraConTiempoVisual[];
  // tiemposRender[i].inicio_s de ESTA escena -- para convertir el
  // tiempo absoluto de una palabra a un cuadro relativo al Sequence de
  // la escena (useCurrentFrame() ya arranca en 0 ahí).
  inicioEscena_s: number;
  // Fotos/videos del álbum ya resueltos a URL (parte 2d, para
  // comparacion_foto). Opcional: el arnés admin no los tiene.
  medios?: MediosResueltos;
};

function cuadroDePalabra(indicePalabra: number, ctx: ContextoVisual): number {
  const palabra = ctx.palabras[indicePalabra];
  if (!palabra) return 0;
  return Math.round((palabra.inicio_s - ctx.inicioEscena_s) * ctx.fps);
}

// cursor_clic/contador/boton_estado no traen su propia tarjeta (a
// diferencia de CelularChat, que se posiciona sola con geometria.ts)
// -- sin esto, caían en el flujo normal de <AbsoluteFill> (column flex
// de Remotion) y terminaban arriba de todo, invadiendo el margen
// superior inseguro (bug real encontrado al revisar el dispatcher:
// ningún case de estos 3 tenía posicionamiento propio). Mismo cajón
// vertical que ocupa la tarjeta del chat, para que los 4 tipos de
// visual vivan siempre en la misma franja y ninguno choque con
// SubtitulosSincronizados (franja fija 54%-65%, ver ese archivo).
function ZonaVisual({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ top: `${TARJETA_TOP_PORCENTAJE}%`, height: `${TARJETA_ALTURA_PORCENTAJE}%`, alignItems: "center", justifyContent: "center" }}>
      {children}
    </AbsoluteFill>
  );
}

// Mismo criterio que el arco de color del molde aprobado: alerta en
// el gancho (problema), éxito en marca/cierre (arreglo) -- nunca un
// color elegido por la IA. COLOR_EXITO_BLOQUE (no COLOR_EXITO): este
// color alimenta colorActivo de BotonEstado (texto blanco encima) en
// más de un case (cursor_clic, boton_estado) -- COLOR_EXITO normal
// solo da 1.98:1 con blanco, bastante por debajo de los 4.5:1 de
// contrasteSuficiente() (ver acento.ts); COLOR_EXITO_BLOQUE ya está
// verificado (5.43:1) justo para este caso.
function colorDeBloque(bloque: BloqueGuion): string {
  return bloque === "gancho" || bloque === "problema" ? COLOR_ALERTA : COLOR_EXITO_BLOQUE;
}

// Parte 2e: un visual de 2 estados SIN evento (el gancho, que muestra
// solo el "problema") cambia en un cuadro que nunca llega dentro de la
// escena -- 3s después de la última palabra, nunca Infinity (spring() e
// interpolate() necesitan números finitos, y el reloj de respuesta_lenta
// sigue corriendo a lo largo de toda la escena).
const SEGUNDOS_FUERA_DE_ESCENA = 3;
function cuadroDelCambio(eventos: { palabra: number }[], ctx: ContextoVisual): number {
  if (eventos.length > 0) return cuadroDePalabra(eventos[0].palabra, ctx);
  const ultima = ctx.palabras[ctx.palabras.length - 1];
  const finEscena_s = ultima ? ultima.fin_s - ctx.inicioEscena_s : 0;
  return Math.round((finEscena_s + SEGUNDOS_FUERA_DE_ESCENA) * ctx.fps);
}

// Parte 2e: el gancho puede usar el estado "problema" de un visual de 2
// estados, que en ese estado es casi quieto (solo celular_chat,
// respuesta_lenta y conexion_whatsapp respiran). Ronda M pidió
// movimiento desde el primer cuadro: entra con un pop corto y después
// respira, igual que el celular del gancho de siempre.
function MovimientoGancho({ frame, fps, children }: { frame: number; fps: number; children: React.ReactNode }) {
  const entrada = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  const escala = (0.9 + 0.1 * entrada) * respiracion(frame, fps);
  return <AbsoluteFill style={{ transform: `scale(${escala})` }}>{children}</AbsoluteFill>;
}

export function renderizarVisual(visual: Visual, ctx: ContextoVisual) {
  const nodo = renderizarVisualSinMovimiento(visual, ctx);
  if (ctx.bloque === "gancho" && visual.tipo !== "celular_chat") {
    return (
      <MovimientoGancho frame={ctx.frame} fps={ctx.fps}>
        {nodo}
      </MovimientoGancho>
    );
  }
  return nodo;
}

function renderizarVisualSinMovimiento(visual: Visual, ctx: ContextoVisual) {
  switch (visual.tipo) {
    case "celular_chat": {
      // El componente promovido solo conoce "notificaciones" (cuadros
      // de llegada) -- ambas acciones (notificacion_llega/numero_sube)
      // alimentan el mismo array: el número gigante ya sube solo por
      // cada notificación que haya "llegado" (frame >= cuadro).
      const notificaciones = visual.eventos.map((evento) => cuadroDePalabra(evento.palabra, ctx));
      // Ronda M (staging): el gancho queda con el contador en 0 quieto
      // (sin eventos, ver la ronda J -- numero_sube/notificacion_llega
      // está prohibido ahí) y se leía como "no está renderizando" en
      // vez de "a propósito en cero". `parpadear` ya existía en
      // CelularChat (opacidadParpadeo, un seno de amplitud chica) --
      // solo faltaba conectarlo acá para el gancho. El VALOR sigue
      // congelado en 0 (notificaciones=[] no cambia), solo la opacidad
      // respira.
      return (
        <CelularChat
          frame={ctx.frame}
          fps={ctx.fps}
          tema={ctx.tema}
          notificaciones={notificaciones}
          colorNumeroGigante={colorDeBloque(ctx.bloque)}
          parpadear={ctx.bloque === "gancho"}
        />
      );
    }

    case "cursor_clic": {
      const aparece = visual.eventos.find((e) => e.accion === "aparece");
      const clic = visual.eventos.find((e) => e.accion === "clic");
      const cuadroAparece = aparece ? cuadroDePalabra(aparece.palabra, ctx) : 0;
      // Si el guion no trajo un evento "clic" explícito (no debería
      // pasar, el schema exige min 1 evento, pero "aparece" solo
      // también es válido), el clic cae 1s después de aparecer en vez
      // de nunca ocurrir.
      const cuadroClic = clic ? cuadroDePalabra(clic.palabra, ctx) : cuadroAparece + ctx.fps;
      const progreso = spring({ frame: ctx.frame - cuadroAparece, fps: ctx.fps, config: { damping: 14 } });
      const activo = ctx.frame >= cuadroClic;
      // Bug real encontrado: este case devolvía SOLO el cursor
      // (CursorClicEventos), sin el botón que "visual.texto_boton"
      // describe -- un dedo apuntando a la nada, "dice" en vez de
      // "mostrar". CursorClicEventos se ancla por position:absolute
      // contra el primer ancestro posicionado, que debe ser el MISMO
      // contenedor que el botón (ver el comentario en BotonEstado.tsx)
      // -- por eso va como children, nunca como hermano suelto.
      return (
        <ZonaVisual>
          <TarjetaSimple>
            <BotonEstado texto={visual.texto_boton} tema={ctx.tema} progreso={progreso} activo={activo} colorActivo={colorDeBloque(ctx.bloque)}>
              <CursorClicEventos frame={ctx.frame} fps={ctx.fps} cuadroAparece={cuadroAparece} cuadroClic={cuadroClic} />
            </BotonEstado>
          </TarjetaSimple>
        </ZonaVisual>
      );
    }

    case "contador": {
      // Sin eventos (gancho, parte 2e): se queda en "desde".
      const cuadros = visual.eventos.length > 0 ? visual.eventos.map((evento) => cuadroDePalabra(evento.palabra, ctx)) : [cuadroDelCambio([], ctx)];
      const cuadroInicio = Math.min(...cuadros);
      const cuadroFin = Math.max(...cuadros);
      const valor = valorContadorEnFrame(ctx.frame, cuadroInicio, cuadroFin, visual.desde, visual.hasta);
      return (
        <ZonaVisual>
          <TarjetaSimple>
            <ContadorGigante valor={valor} etiqueta={visual.etiqueta} color={colorDeBloque(ctx.bloque)} />
          </TarjetaSimple>
        </ZonaVisual>
      );
    }

    case "boton_estado": {
      const aparece = visual.eventos.find((e) => e.accion === "aparece");
      const cambia = visual.eventos.find((e) => e.accion === "clic" || e.accion === "cambia_estado");
      const cuadroAparece = aparece ? cuadroDePalabra(aparece.palabra, ctx) : 0;
      const cuadroCambia = cambia ? cuadroDePalabra(cambia.palabra, ctx) : null;
      const progreso = spring({ frame: ctx.frame - cuadroAparece, fps: ctx.fps, config: { damping: 14 } });
      const activo = cuadroCambia !== null && ctx.frame >= cuadroCambia;
      // Ronda H: en la escena "cta", el @usuario que ve la persona
      // tiene que ser el real (ctx.tema.instagramUsuario, resuelto por
      // código en la ruta -- ver video/tema.ts), nunca el que la IA
      // haya inventado en visual.texto/texto_activo. En cualquier otro
      // bloque que use boton_estado, el texto de la IA sigue intacto.
      const textoIdle = ctx.bloque === "cta" ? (ctx.tema.instagramUsuario ? `Seguir @${ctx.tema.instagramUsuario}` : "Seguir") : visual.texto;
      const textoActivo = ctx.bloque === "cta" ? (ctx.tema.instagramUsuario ? `Siguiendo @${ctx.tema.instagramUsuario}` : "Siguiendo") : visual.texto_activo;
      return (
        <ZonaVisual>
          <TarjetaSimple>
            <BotonEstado texto={activo ? textoActivo : textoIdle} conCheck={activo && ctx.bloque === "cta"} tema={ctx.tema} progreso={progreso} activo={activo} colorActivo={COLOR_EXITO_BLOQUE} />
          </TarjetaSimple>
        </ZonaVisual>
      );
    }

    // Los 3 siguientes son de 2 estados (problema->arreglo) y se
    // posicionan solos (mismo criterio que CelularChat) -- nunca
    // dentro de ZonaVisual/TarjetaSimple, ya traen su propia tarjeta
    // (o, en conexion_whatsapp, 2 tarjetas apiladas).
    case "anuncio_boton": {
      const cuadroCambia = cuadroDelCambio(visual.eventos, ctx);
      return (
        <AnuncioBotonVisual
          frame={ctx.frame}
          fps={ctx.fps}
          tema={ctx.tema}
          cuadroCambia={cuadroCambia}
          textos={{ icono: visual.icono, etiqueta: visual.etiqueta, texto_problema: visual.texto_problema, texto_arreglo: visual.texto_arreglo }}
        />
      );
    }

    case "conexion_whatsapp": {
      const cuadroCambia = cuadroDelCambio(visual.eventos, ctx);
      return (
        <ConexionWhatsappVisual
          frame={ctx.frame}
          fps={ctx.fps}
          tema={ctx.tema}
          cuadroCambia={cuadroCambia}
          textos={{ icono: visual.icono, etiqueta: visual.etiqueta, texto_problema: visual.texto_problema, mensaje: visual.mensaje }}
        />
      );
    }

    case "comparacion": {
      const cuadroCambia = cuadroDelCambio(visual.eventos, ctx);
      return (
        <ComparacionVisual
          frame={ctx.frame}
          fps={ctx.fps}
          cuadroCambia={cuadroCambia}
          textoMal={visual.texto_mal}
          textoBien={visual.texto_bien}
          etiquetaMal={visual.etiqueta_mal}
          etiquetaBien={visual.etiqueta_bien}
        />
      );
    }

    case "icono_palabra": {
      const cuadroCambia = cuadroDelCambio(visual.eventos, ctx);
      return (
        <IconoPalabraVisual
          frame={ctx.frame}
          fps={ctx.fps}
          tema={ctx.tema}
          cuadroCambia={cuadroCambia}
          iconoAntes={visual.icono_antes}
          palabraAntes={visual.palabra_antes}
          iconoDespues={visual.icono_despues}
          palabraDespues={visual.palabra_despues}
        />
      );
    }

    case "checklist": {
      const cuadroCambia = cuadroDelCambio(visual.eventos, ctx);
      return <ChecklistVisual frame={ctx.frame} fps={ctx.fps} cuadroCambia={cuadroCambia} titulo={visual.titulo} items={visual.items} />;
    }

    case "comparacion_foto": {
      const cuadroCambia = cuadroDelCambio(visual.eventos, ctx);
      const medio = ctx.medios?.[visual.media_id];
      const urlFoto = medio && medio.tipo === "imagen" ? medio.url : null;
      return <ComparacionFotoVisual frame={ctx.frame} fps={ctx.fps} cuadroCambia={cuadroCambia} urlFoto={urlFoto} textoMal={visual.texto_mal} textoBien={visual.texto_bien} />;
    }

    case "respuesta_lenta": {
      const cuadroCambia = cuadroDelCambio(visual.eventos, ctx);
      return (
        <RespuestaLentaVisual
          frame={ctx.frame}
          fps={ctx.fps}
          cuadroCambia={cuadroCambia}
          textos={{ pregunta_cliente: visual.pregunta_cliente, respuesta: visual.respuesta, confirmacion: visual.confirmacion }}
        />
      );
    }
  }
}
