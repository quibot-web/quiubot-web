// Reel de referencia #2 (Fase A del pivote visual, mismo molde que
// ReelConsejosNumerados.tsx -- ver
// /Users/juanshow/.claude/plans/peppy-frolicking-penguin.md y
// visuales/molde.tsx) -- hecho a mano, NO pasa por
// GuionSchema/renderizarEscena/Composicion.tsx.
//
// Tema: 2 mitos sobre pauta/mensajes, marca real Quiubot. Receta de
// referencia: mito_verdad (gancho -> objecion -> objecion -> cta), acá
// con una escena extra de cierre de bucle + marca (mismo patrón que el
// Reel 1).
//
// SEGUNDA VERSIÓN (15 nov 2026) tras revisión del usuario sobre la v1:
// el mensaje de fondo del mito 1 estaba MAL -- la barra de presupuesto
// bajaba mientras los mensajes subían, lo que se lee como "gasta menos
// y vende más" (falso, al revés de la verdad real). Reescrito por
// completo:
// - Mito 1: "Más presupuesto = más mensajes" -> verdad "El presupuesto
//   multiplica lo que ya funciona". El presupuesto queda FIJO (nunca
//   cambia -- AnuncioEvolucionaConPresupuesto.tsx); lo que cambia es el
//   ANUNCIO (sin botón -> con botón, texto flojo -> claro) con el MISMO
//   presupuesto.
// - Mito 2: foto real de producto (no un emoji), oscura/borrosa ->
//   clara (ComparacionFoto.tsx).
// - Estructura "mito -> verdad" visible en el TITULAR de cada escena de
//   mito (TitularMitoVerdad.tsx: sello "MITO" + frase tachada en alerta,
//   después "VERDAD:" + frase correcta en verde) -- nunca queda el mito
//   como título mientras se ve el arreglo, los 2 usan el MISMO
//   cuadroCorte que el visual.
// - El cierre del bucle ya NO repite la tarjeta de presupuesto: responde
//   directo la pregunta del gancho con "2 de 2 eran mito ✗"
//   (MarcadorMitos.tsx), en un recuadro sólido (ver v3 abajo).
//
// TERCERA VERSIÓN (15 nov 2026) tras revisión del usuario sobre la v2:
// - Foto del mito 2 SIN ninguna marca visible (la v2 usaba un tenis con
//   el logo y el swoosh de Nike) -- ahora una vasija de cerámica
//   genérica (ComparacionFoto.tsx).
// - Titulares MITO/VERDAD y el marcador del cierre ya NO ponen texto de
//   color directo sobre el degradado morado/azul (el contraste real no
//   llegaba a 4.5:1, ver COLOR_ALERTA_BLOQUE/COLOR_EXITO_BLOQUE en
//   acento.ts y contrasteSuficiente() en video/tema.ts) -- ahora texto
//   blanco sobre un recuadro sólido.
// - Gancho reescrito: titular claro ("2 mitos que te hacen perder plata
//   en anuncios") + 2 tarjetas boca abajo con movimiento propio
//   (TarjetasMitoBocaAbajo.tsx), en vez del marcador "? de 2" (poco
//   claro por sí solo).
// - El gancho ya no deja su texto montado sobre la tarjeta del mito 1
//   durante la transición (se desvanece un poco antes de que la escena
//   termine, en vez de cortar seco al cruce global).
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { familiaDeFuente } from "../../../fuentes";
import { colorTextoSobre, respiracion, type TemaGuion } from "../../../tema";
import { FondoMarca } from "../../../capas/FondoMarca";
import { CUADROS_TRANSICION } from "../../../Composicion";
import { AnuncioEvolucionaConPresupuesto } from "./visuales/AnuncioEvolucionaConPresupuesto";
import { ComparacionFoto } from "./visuales/ComparacionFoto";
import { MarcadorMitos } from "./visuales/MarcadorMitos";
import { TarjetasMitoBocaAbajo } from "./visuales/TarjetasMitoBocaAbajo";
import { TitularMitoVerdad } from "./visuales/TitularMitoVerdad";
import { BucleChip } from "./visuales/BucleChip";
import { TinteAcento } from "./visuales/TinteAcento";
import { FormasInferior } from "./visuales/FormasInferior";
import { COLOR_EXITO } from "./visuales/acento";
import { TEMA_QUIUBOT, Titular, EsquinaMarca } from "./visuales/molde";

const FPS = 30;

const DURACION_S = { gancho: 2.3, mito1: 4.8, mito2: 4.8, cierre: 4.6, cta: 2.5 } as const;

function cuadros(s: number): number {
  return Math.round(s * FPS);
}

export function duracionReelMitoVerdadEnCuadros(): number {
  const base = Object.values(DURACION_S).reduce((acc, s) => acc + cuadros(s), 0);
  return base + CUADROS_TRANSICION;
}

function EscenaGancho({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const duracionCuadros = cuadros(DURACION_S.gancho);
  // Se desvanece ANTES de que la escena termine, para que el cruce
  // global con el mito 1 (TransitionSeries + fade()) ya no superponga
  // 2 textos -- ajuste explícito del usuario.
  const opacidadSalida = interpolate(frame, [duracionCuadros - 16, duracionCuadros - 3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="gancho" organico medioDeFondo={null} />
      <FormasInferior />
      <AbsoluteFill style={{ opacity: opacidadSalida }}>
        <Titular texto="2 mitos que te hacen perder plata en anuncios" colorTexto={colorTexto} />
        <TarjetasMitoBocaAbajo frame={frame} fps={fps} total={2} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function EscenaMito1({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duracionCuadros = cuadros(DURACION_S.mito1);
  const cuadroCorte = Math.round(duracionCuadros * 0.42);
  const escalaCamara = interpolate(frame, [cuadroCorte - 6, cuadroCorte + 20], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progresoAcento = interpolate(frame, [cuadroCorte - 10, cuadroCorte + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="objecion" organico medioDeFondo={null} />
      <TinteAcento progreso={progresoAcento} />
      <FormasInferior />
      <BucleChip paso={1} total={2} />
      {/* "trae", no "=" -- la fuente cargada (Poppins, igual que el
          hallazgo real de la flecha "↓" en FlujoPasos.tsx) no tiene ese
          glifo: se veía como un cuadro blanco sólido en el render real. */}
      <TitularMitoVerdad mito="Más presupuesto trae más mensajes" verdad="El presupuesto multiplica lo que ya funciona" cuadroCorte={cuadroCorte} />
      <AnuncioEvolucionaConPresupuesto frame={frame} fps={fps} tema={tema} cuadroCorte={cuadroCorte} duracionCuadros={duracionCuadros} escalaCamara={escalaCamara} />
    </AbsoluteFill>
  );
}

function EscenaMito2({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duracionCuadros = cuadros(DURACION_S.mito2);
  const cuadroCorte = Math.round(duracionCuadros * 0.45);
  const escalaCamara = interpolate(frame, [cuadroCorte - 6, cuadroCorte + 20], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progresoAcento = interpolate(frame, [cuadroCorte - 10, cuadroCorte + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="objecion" organico medioDeFondo={null} />
      <TinteAcento progreso={progresoAcento} />
      <FormasInferior />
      <BucleChip paso={2} total={2} />
      <TitularMitoVerdad mito="Cualquier foto sirve para el anuncio" verdad="Una foto real y clara vende más" cuadroCorte={cuadroCorte} />
      <ComparacionFoto frame={frame} fps={fps} tema={tema} cuadroCorte={cuadroCorte} escalaCamara={escalaCamara} />
    </AbsoluteFill>
  );
}

// Cierre del bucle + marca, mismo patrón del Reel 1: 2 fases dentro de
// la misma escena, nunca visibles a la vez.
function EscenaCierre({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const escalaRespiracion = respiracion(frame, fps);

  const opacidadFaseA = interpolate(frame, [0, 10, 78, 92], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacidadFaseB = interpolate(frame, [98, 118], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="marca" organico medioDeFondo={null} />
      <FormasInferior />
      <AbsoluteFill style={{ opacity: opacidadFaseA }}>
        {/* Responde directo la pregunta del gancho -- ya NO repite la
            tarjeta de presupuesto (pedido explícito, v2). */}
        <MarcadorMitos total={2} />
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
          Separamos los mitos de lo que sí funciona
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const PALABRA_COMENTAR = "MITO";

// ~2.5s: escribe "MITO" letra por letra -> cambia a "¡Comentado! ✓" --
// mismo gesto de "muestra, no digas" que ya usa CtaComentar en
// producción (video/escenas/Cta.tsx), hecho a mano acá porque este reel
// no pasa por el sistema de escenas real.
function EscenaCta({ tema }: { tema: TemaGuion }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colorTexto = colorTextoSobre(tema.color_primario);
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const escalaRespiracion = respiracion(frame, fps);

  const cuadroInicioEscritura = Math.round(fps * 0.3);
  const cuadroFinEscritura = cuadroInicioEscritura + Math.round(fps * 0.6);
  const letrasVisibles = Math.floor(
    interpolate(frame, [cuadroInicioEscritura, cuadroFinEscritura], [0, PALABRA_COMENTAR.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const terminoDeEscribir = letrasVisibles >= PALABRA_COMENTAR.length;
  const cuadroConfirmado = cuadroFinEscritura + Math.round(fps * 0.3);
  const confirmado = frame >= cuadroConfirmado;
  const cursorVisible = !confirmado && (terminoDeEscribir ? Math.floor(frame / (fps * 0.5)) % 2 === 0 : true);
  const progresoConfirmado = spring({ frame: frame - cuadroConfirmado, fps, config: { damping: 10, mass: 0.4 } });

  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" bloque="cta" organico medioDeFondo={null} />
      <FormasInferior />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
        <div style={{ fontSize: 50, fontWeight: 800, color: colorTexto, textAlign: "center", marginBottom: 36, opacity: progreso, transform: `scale(${escalaRespiracion})` }}>
          ¿Tú también lo creías?
        </div>
        <div
          style={{
            width: "90%",
            background: confirmado ? COLOR_EXITO : "rgba(255,255,255,0.95)",
            borderRadius: 999,
            padding: "22px 36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            opacity: progreso,
            transform: `scale(${Math.min(progreso, 1) * (confirmado ? 1 + interpolate(progresoConfirmado, [0, 1], [0.1, 0]) : 1)})`,
          }}
        >
          {confirmado ? (
            <span style={{ fontSize: 44, fontWeight: 800, color: "#fff" }}>¡Comentado! ✓</span>
          ) : (
            <>
              <span style={{ fontSize: 40 }}>💬</span>
              <span style={{ fontSize: 42, fontWeight: 800, color: "#111" }}>
                {PALABRA_COMENTAR.slice(0, letrasVisibles)}
                <span style={{ opacity: cursorVisible ? 1 : 0 }}>|</span>
              </span>
            </>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const ESCENAS = [
  { id: "gancho", duracionS: DURACION_S.gancho, Componente: EscenaGancho },
  { id: "mito1", duracionS: DURACION_S.mito1, Componente: EscenaMito1 },
  { id: "mito2", duracionS: DURACION_S.mito2, Componente: EscenaMito2 },
  { id: "cierre", duracionS: DURACION_S.cierre, Componente: EscenaCierre },
  { id: "cta", duracionS: DURACION_S.cta, Componente: EscenaCta },
] as const;

export function ReelMitoVerdad() {
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
