import { AbsoluteFill, spring } from "remotion";
import type { TemaGuion } from "../tema";
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
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
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
// color elegido por la IA.
function colorDeBloque(bloque: BloqueGuion): string {
  return bloque === "gancho" || bloque === "problema" ? COLOR_ALERTA : COLOR_EXITO;
}

export function renderizarVisual(visual: Visual, ctx: ContextoVisual) {
  switch (visual.tipo) {
    case "celular_chat": {
      // El componente promovido solo conoce "notificaciones" (cuadros
      // de llegada) -- ambas acciones (notificacion_llega/numero_sube)
      // alimentan el mismo array: el número gigante ya sube solo por
      // cada notificación que haya "llegado" (frame >= cuadro).
      const notificaciones = visual.eventos.map((evento) => cuadroDePalabra(evento.palabra, ctx));
      return (
        <CelularChat frame={ctx.frame} fps={ctx.fps} tema={ctx.tema} notificaciones={notificaciones} colorNumeroGigante={colorDeBloque(ctx.bloque)} />
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
      const cuadros = visual.eventos.map((evento) => cuadroDePalabra(evento.palabra, ctx));
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
      return (
        <ZonaVisual>
          <TarjetaSimple>
            <BotonEstado texto={activo ? visual.texto_activo : visual.texto} tema={ctx.tema} progreso={progreso} activo={activo} colorActivo={COLOR_EXITO} />
          </TarjetaSimple>
        </ZonaVisual>
      );
    }

    // Los 3 siguientes son de 2 estados (problema->arreglo) y se
    // posicionan solos (mismo criterio que CelularChat) -- nunca
    // dentro de ZonaVisual/TarjetaSimple, ya traen su propia tarjeta
    // (o, en conexion_whatsapp, 2 tarjetas apiladas).
    case "anuncio_boton": {
      const cuadroCambia = cuadroDePalabra(visual.eventos[0].palabra, ctx);
      return <AnuncioBotonVisual frame={ctx.frame} fps={ctx.fps} tema={ctx.tema} cuadroCambia={cuadroCambia} />;
    }

    case "conexion_whatsapp": {
      const cuadroCambia = cuadroDePalabra(visual.eventos[0].palabra, ctx);
      return <ConexionWhatsappVisual frame={ctx.frame} fps={ctx.fps} tema={ctx.tema} cuadroCambia={cuadroCambia} />;
    }

    case "respuesta_lenta": {
      const cuadroCambia = cuadroDePalabra(visual.eventos[0].palabra, ctx);
      return <RespuestaLentaVisual frame={ctx.frame} fps={ctx.fps} cuadroCambia={cuadroCambia} />;
    }
  }
}
