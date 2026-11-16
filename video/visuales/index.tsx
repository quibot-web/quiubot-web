import { spring } from "remotion";
import type { TemaGuion } from "../tema";
import type { BloqueGuion } from "../guion.schema";
import type { Visual } from "./schema";
import { CelularChat } from "./CelularChat";
import { CursorClicEventos } from "./CursorClicEventos";
import { BotonEstado } from "./BotonEstado";
import { ContadorBadge, valorContadorEnFrame } from "./Contador";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";

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
      return <CursorClicEventos frame={ctx.frame} fps={ctx.fps} cuadroAparece={cuadroAparece} cuadroClic={cuadroClic} />;
    }

    case "contador": {
      const cuadros = visual.eventos.map((evento) => cuadroDePalabra(evento.palabra, ctx));
      const cuadroInicio = Math.min(...cuadros);
      const cuadroFin = Math.max(...cuadros);
      const valor = valorContadorEnFrame(ctx.frame, cuadroInicio, cuadroFin, visual.desde, visual.hasta);
      return <ContadorBadge valor={valor} color={colorDeBloque(ctx.bloque)} colorTexto="#fff" tamano={130} />;
    }

    case "boton_estado": {
      const aparece = visual.eventos.find((e) => e.accion === "aparece");
      const cambia = visual.eventos.find((e) => e.accion === "clic" || e.accion === "cambia_estado");
      const cuadroAparece = aparece ? cuadroDePalabra(aparece.palabra, ctx) : 0;
      const cuadroCambia = cambia ? cuadroDePalabra(cambia.palabra, ctx) : null;
      const progreso = spring({ frame: ctx.frame - cuadroAparece, fps: ctx.fps, config: { damping: 14 } });
      const activo = cuadroCambia !== null && ctx.frame >= cuadroCambia;
      return (
        <BotonEstado texto={activo ? visual.texto_activo : visual.texto} tema={ctx.tema} progreso={progreso} activo={activo} colorActivo={COLOR_EXITO} />
      );
    }
  }
}
