// Reel de referencia #1 (Fase A del pivote visual, ver el plan en
// /Users/juanshow/.claude/plans/peppy-frolicking-penguin.md) -- hecho a
// mano, NO pasa por GuionSchema/renderizarEscena/Composicion.tsx: es un
// árbol de React independiente, solo registrado como <Composition> en
// Root.tsx para poder previsualizarlo/renderizarlo con las mismas
// herramientas (Studio, @remotion/renderer, @remotion/web-renderer).
//
// Tema: "anuncios que no traen mensajes" (marca real: Quiubot). Receta
// de referencia: consejos_numerados (gancho -> valor -> marca -> cta).
//
// SEGUNDA VERSIÓN (15 nov 2026) tras revisión del usuario sobre la v1:
// - Escala: el elemento principal pasa de ~25% a 70-85% del ancho (ver
//   visuales/geometria.ts), con tipografía legible a tamaño real de
//   teléfono (mensajes a 40-44px, antes 22px).
// - Pantalla llena: el titular + la tarjeta ocupan juntos toda la zona
//   segura (14%-65%), sin áreas vacías grandes.
// - "Muestra, no digas": el bloque valor ya NO es una lista de 3
//   razones en texto -- son 3 escenas propias, cada una con su propio
//   problema -> arreglo visual (botón, conexión de WhatsApp, respuesta
//   lenta), con el contador "1/3, 2/3, 3/3" como bucle persistente
//   (BucleChip, mismo lenguaje visual que capas/Bucle.tsx).
// - El logo real (public/marca/icono-quiubot.svg) se lee como spinner
//   de carga en este formato -- se reemplaza por el nombre "Quiubot" en
//   texto/un monograma "Q", nunca el ícono real (ese archivo no se
//   toca, es el asset de marca real).
// - El cursor del CTA ya no tapa el subtexto (más separación vertical).
//
// TERCERA VERSIÓN (15 nov 2026) tras revisión del usuario sobre la v2:
// - Contenido que llena la tarjeta: reloj grande con 3 valores reales
//   (00:05 -> 02:30 -> 15:00) en vez de un ícono chico, ícono de
//   conexión cortada grande, anuncio y celular ambos grandes en 2/3.
// - Arco de color: acentos rojo/naranja (problema) y verde (arreglo) en
//   bordes/íconos + un tinte sutil de fondo (TinteAcento) en las 3
//   escenas de valor.
// - Cierra el bucle: la fase A de la escena de marca ya no repite una
//   conversación (eso ya lo mostró "respuesta lenta") -- vuelve al
//   MISMO celular del gancho, ahora con notificaciones entrando y el
//   contador subiendo.
// - CTA de ~2.5s: clic -> el botón cambia a "Siguiendo ✓" -- sin
//   cuadros quietos.
// - Detalles: botón "Enviar mensaje" más ancho (el cursor ya no tapa el
//   texto), textos del anuncio más grandes, el "0 mensajes nuevos" del
//   gancho parpadea, y la banda fuera de zona segura lleva 2 formas de
//   marca más (FormasInferior) para que no se sienta vacía.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { familiaDeFuente } from "../../../fuentes";
import { colorTextoSobre, respiracion, type TemaGuion } from "../../../tema";
import { FondoMarca } from "../../../capas/FondoMarca";
import { CUADROS_TRANSICION } from "../../../Composicion";
import { CelularChat } from "./visuales/CelularChat";
import { CursorClicGenerico } from "./visuales/CursorClicGenerico";
import { AnuncioBoton } from "./visuales/AnuncioBoton";
import { ConexionWhatsapp } from "./visuales/ConexionWhatsapp";
import { RespuestaLenta } from "./visuales/RespuestaLenta";
import { BucleChip } from "./visuales/BucleChip";
import { TinteAcento } from "./visuales/TinteAcento";
import { FormasInferior } from "./visuales/FormasInferior";
import { COLOR_ALERTA, COLOR_EXITO } from "./visuales/acento";
import { TEMA_QUIUBOT, Titular, EsquinaMarca, BotonEstado } from "./visuales/molde";

const FPS = 30;

const DURACION_S = { gancho: 2.3, boton: 4.8, whatsapp: 4.8, respuesta: 4.8, marca: 4.6, cta: 2.5 } as const;

function cuadros(s: number): number {
  return Math.round(s * FPS);
}

export function duracionReelConsejosNumeradosEnCuadros(): number {
  const base = Object.values(DURACION_S).reduce((acc, s) => acc + cuadros(s), 0);
  return base + CUADROS_TRANSICION;
}

function EscenaGancho({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="gancho" organico medioDeFondo={null} />
      <FormasInferior />
      <Titular texto="¿Tus anuncios no traen mensajes?" colorTexto={colorTexto} />
      {/* "0" gigante en color de alerta (pedido explícito, v4) -- el
          mismo celular y la misma posición que usará el cierre del
          bucle en la escena de marca, para que el callback se lea de
          un vistazo. */}
      <CelularChat frame={frame} fps={fps} tema={tema} colorNumeroGigante={COLOR_ALERTA} parpadear />
    </AbsoluteFill>
  );
}

function EscenaBoton({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const duracionCuadros = cuadros(DURACION_S.boton);
  const cuadroCorte = Math.round(duracionCuadros * 0.42);
  // Acercamiento de cámara: un empuje sutil hacia la tarjeta justo
  // cuando aparece el botón (pedido explícito: "acercamientos de
  // cámara... al botón").
  const escalaCamara = interpolate(frame, [cuadroCorte - 6, cuadroCorte + 20], [1, 1.07], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progresoAcento = interpolate(frame, [cuadroCorte - 10, cuadroCorte + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="valor" organico medioDeFondo={null} />
      <TinteAcento progreso={progresoAcento} />
      <FormasInferior />
      <BucleChip paso={1} total={3} />
      <Titular texto="Sin botón, el cliente no te escribe" colorTexto={colorTexto} />
      <AnuncioBoton frame={frame} fps={fps} tema={tema} cuadroCorte={cuadroCorte} duracionCuadros={duracionCuadros} escalaCamara={escalaCamara} />
    </AbsoluteFill>
  );
}

function EscenaWhatsapp({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const duracionCuadros = cuadros(DURACION_S.whatsapp);
  const cuadroCorte = Math.round(duracionCuadros * 0.45);
  const escalaCamara = interpolate(frame, [cuadroCorte - 6, cuadroCorte + 20], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progresoAcento = interpolate(frame, [cuadroCorte - 10, cuadroCorte + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="valor" organico medioDeFondo={null} />
      <TinteAcento progreso={progresoAcento} />
      <FormasInferior />
      <BucleChip paso={2} total={3} />
      <Titular texto="El mensaje no llegaba a WhatsApp" colorTexto={colorTexto} />
      <ConexionWhatsapp frame={frame} fps={fps} tema={tema} cuadroCorte={cuadroCorte} escalaCamara={escalaCamara} />
    </AbsoluteFill>
  );
}

function EscenaRespuestaLenta({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const duracionCuadros = cuadros(DURACION_S.respuesta);
  const cuadroCorte = Math.round(duracionCuadros * 0.5);
  const escalaCamara = interpolate(frame, [cuadroCorte - 6, cuadroCorte + 20], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progresoAcento = interpolate(frame, [cuadroCorte - 10, cuadroCorte + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="valor" organico medioDeFondo={null} />
      <TinteAcento progreso={progresoAcento} />
      <FormasInferior />
      <BucleChip paso={3} total={3} />
      <Titular texto="Nadie respondía a tiempo" colorTexto={colorTexto} />
      <RespuestaLenta frame={frame} fps={fps} tema={tema} cuadroCorte={cuadroCorte} escalaCamara={escalaCamara} />
    </AbsoluteFill>
  );
}

// Dos fases dentro de la MISMA escena (no dos escenas -- el ritmo
// pedido es "un cambio visual cada 1.5-2.5s", no solo un cambio por
// escena): primero "cierra el bucle" volviendo al MISMO celular del
// gancho (misma tarjeta, mismo encabezado) pero ahora con notificaciones
// entrando y el contador subiendo -- ajuste explícito del usuario:
// antes esta fase repetía una conversación (eso ya lo muestra la
// escena "respuesta lenta"), ahora es el callback visual al gancho.
// Después, un crossfade interno hacia el nombre + frase de marca. Las
// dos fases NUNCA están visibles a la vez (se probó con cruce clásico
// y las dos capas, al estar centradas en la misma zona, quedaban
// ilegibles superpuestas).
function EscenaMarca({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const escalaRespiracion = respiracion(frame, fps);

  const opacidadFaseA = interpolate(frame, [0, 10, 78, 92], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacidadFaseB = interpolate(frame, [98, 118], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Exactamente 3 (no 5): cierra el bucle con el MISMO "de 0 a 3" que ya
  // anuncia el gancho y el bucle "1/3, 2/3, 3/3" del bloque valor --
  // puramente ilustrativo, no son datos reales de ninguna cuenta (regla
  // explícita del usuario: nunca una cifra inventada como resultado
  // real de Quiubot).
  const notificaciones = [15, 45, 75];

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="marca" organico medioDeFondo={null} />
      <FormasInferior />
      <AbsoluteFill style={{ opacity: opacidadFaseA }}>
        <Titular texto="Ahora sí llegan los mensajes" colorTexto={colorTexto} />
        {/* Mismo celular y misma posición que el gancho, con el número
            gigante subiendo 0->3 en verde mientras las notificaciones
            entran detrás (pedido explícito, v4). */}
        <CelularChat frame={frame} fps={fps} tema={tema} notificaciones={notificaciones} colorNumeroGigante={COLOR_EXITO} mostrarContadorNuevos />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: opacidadFaseB, justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: colorTexto,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
            transform: `scale(${escalaRespiracion})`,
          }}
        >
          <span style={{ fontSize: 90, fontWeight: 900, color: tema.color_primario }}>Q</span>
        </div>
        <div style={{ fontSize: 58, fontWeight: 900, color: colorTexto, marginBottom: 22 }}>Quiubot</div>
        <div style={{ fontSize: 68, fontWeight: 800, color: colorTexto, textAlign: "center", lineHeight: 1.1, transform: `scale(${escalaRespiracion})` }}>
          Anuncios que sí generan conversación real
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ~2.5s, pedido explícito: clic -> el botón cambia a "Siguiendo ✓" ->
// fin, sin cuadros quietos (respiracion() corre toda la escena, no solo
// en la entrada).
function EscenaCta({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const duracionCuadros = cuadros(DURACION_S.cta);
  const cuadroClic = Math.round(duracionCuadros * 0.6);
  const siguiendo = frame >= cuadroClic;
  const progresoCambio = spring({ frame: frame - cuadroClic, fps, config: { damping: 10, mass: 0.4 } });
  const escalaRespiracion = respiracion(frame, fps);

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="cta" organico medioDeFondo={null} />
      <FormasInferior />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
        <div style={{ fontSize: 50, fontWeight: 800, color: colorTexto, textAlign: "center", marginBottom: 36, opacity: progreso, transform: `scale(${escalaRespiracion})` }}>
          Síguenos para más tips
        </div>
        <BotonEstado
          texto={siguiendo ? "Siguiendo ✓" : "Seguir @quiubot"}
          tema={tema}
          progreso={progreso}
          activo={siguiendo}
          colorActivo={COLOR_EXITO}
          escalaExtra={siguiendo ? 1 + interpolate(progresoCambio, [0, 1], [0.12, 0]) : 1}
        >
          {!siguiendo && <CursorClicGenerico frame={frame} fps={fps} duracionCuadros={duracionCuadros} />}
        </BotonEstado>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const ESCENAS = [
  { id: "gancho", duracionS: DURACION_S.gancho, Componente: EscenaGancho },
  { id: "boton", duracionS: DURACION_S.boton, Componente: EscenaBoton },
  { id: "whatsapp", duracionS: DURACION_S.whatsapp, Componente: EscenaWhatsapp },
  { id: "respuesta", duracionS: DURACION_S.respuesta, Componente: EscenaRespuestaLenta },
  { id: "marca", duracionS: DURACION_S.marca, Componente: EscenaMarca },
  { id: "cta", duracionS: DURACION_S.cta, Componente: EscenaCta },
] as const;

export function ReelConsejosNumerados() {
  const tema = TEMA_QUIUBOT;
  const familia = familiaDeFuente(tema.fuente);

  const nodos = ESCENAS.flatMap(({ id, duracionS, Componente }, i) => {
    const grupo: React.ReactNode[] = [
      <TransitionSeries.Sequence key={id} durationInFrames={cuadros(duracionS) + CUADROS_TRANSICION}>
        <Componente tema={tema} />
      </TransitionSeries.Sequence>,
    ];
    if (i < ESCENAS.length - 1) {
      grupo.push(
        <TransitionSeries.Transition key={`${id}-transicion`} presentation={fade()} timing={linearTiming({ durationInFrames: CUADROS_TRANSICION })} />
      );
    }
    return grupo;
  });

  return (
    <AbsoluteFill style={{ fontFamily: familia }}>
      <TransitionSeries>{nodos}</TransitionSeries>
      <EsquinaMarca tema={tema} />
    </AbsoluteFill>
  );
}
