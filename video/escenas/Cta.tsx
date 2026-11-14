import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";
import type { TemaGuion } from "../tema";

const COLOR_WHATSAPP = "#25D366";
// El botón SIEMPRE mide 80% del ancho de la zona segura (88% del cuadro
// completo) -- antes solo crecía a eso cuando el texto era largo; con
// texto corto quedaba "fit-content" y se veía chico. Ahora el ancho es
// fijo y lo único que varía con el largo del texto es el tamaño de letra.
const ANCHO_MAX_PX = 1080 * 0.88 * 0.8;
const ANCHO_BOTON_PORCENTAJE = `${((ANCHO_MAX_PX / 1080) * 100).toFixed(1)}%`;
const PADDING_HORIZONTAL_PX = 56;
const FUENTE_IDEAL = 56;
const FUENTE_MINIMA = 44;

// Letra ideal de 56px; solo si el texto no cabe en el ancho fijo del
// botón se baja la letra, nunca por debajo de 44px -- Remotion no mide
// texto real sin sumar @remotion/layout-utils, así que esto es una
// aproximación por cantidad de caracteres (0.68 probado contra
// "Escríbenos por WhatsApp" y "Pide tu cotización gratis", los textos
// reales más largos de las recetas).
function calcularFuenteBoton(texto: string): number {
  const anchoAFuenteIdeal = texto.length * FUENTE_IDEAL * 0.68 + PADDING_HORIZONTAL_PX;
  if (anchoAFuenteIdeal <= ANCHO_MAX_PX) return FUENTE_IDEAL;
  return Math.max(FUENTE_MINIMA, Math.floor((ANCHO_MAX_PX - PADDING_HORIZONTAL_PX) / (texto.length * 0.68)));
}

// El botón NUNCA usa el secundario de la marca como relleno: si el
// secundario queda parecido al primario (fondos de la misma familia de
// color, caso real: "retargeting" con primario y secundario teal), el
// botón se funde con el fondo. Con blanco/casi negro -- el que mejor
// contraste contra el fondo real -- el botón resalta siempre, sin
// importar la paleta de marca.
function BotonGrande({ texto, tema, progreso }: { texto: string; tema: TemaGuion; progreso: number }) {
  const colorBoton = colorTextoSobre(tema.color_primario);
  const colorTexto = colorTextoSobre(colorBoton);
  const fontSize = calcularFuenteBoton(texto);
  return (
    <div
      style={{
        width: ANCHO_BOTON_PORCENTAJE,
        background: colorBoton,
        color: colorTexto,
        borderRadius: 999,
        padding: `26px ${PADDING_HORIZONTAL_PX / 2}px`,
        fontSize,
        fontWeight: 800,
        textAlign: "center",
        whiteSpace: "nowrap",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        transform: `scale(${progreso})`,
      }}
    >
      {texto}
    </div>
  );
}

// El cursor que "hace clic" en web y formulario -- se ancla al botón
// mismo (abajo-derecha de su caja real vía position:relative en el
// contenedor), nunca a un punto adivinado de la pantalla completa.
function CursorClic({ frame, fps, duracionCuadros }: { frame: number; fps: number; duracionCuadros: number }) {
  const cuadroClic = Math.round(duracionCuadros * 0.6);
  const llegada = interpolate(frame, [fps * 0.3, cuadroClic], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clic = spring({ frame: frame - cuadroClic, fps, config: { damping: 6, mass: 0.4 } });
  const escalaCursor = 1 - Math.sin(Math.min(clic, 1) * Math.PI) * 0.3;
  return (
    <div
      style={{
        position: "absolute",
        fontSize: 104,
        right: `${interpolate(llegada, [0, 1], [-34, 4])}%`,
        bottom: `${interpolate(llegada, [0, 1], [-70, -22])}%`,
        transform: `scale(${escalaCursor}) rotate(-20deg)`,
        opacity: interpolate(frame, [0, fps * 0.2], [0, 1], { extrapolateRight: "clamp" }),
        filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
      }}
    >
      👆
    </div>
  );
}

function CtaWhatsapp({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto_boton, mensajes, subtexto } = escena.params;
  const progresoBoton = spring({ frame: frame - (mensajes?.length ?? 0) * 8, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      {mensajes && mensajes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 40, alignSelf: "flex-start", maxWidth: "78%" }}>
          {mensajes.map((m, i) => {
            const p = spring({ frame: frame - i * 8, fps, config: { damping: 14 } });
            return (
              <div
                key={i}
                style={{
                  background: COLOR_WHATSAPP,
                  color: "#fff",
                  borderRadius: "26px 26px 26px 4px",
                  padding: "24px 32px",
                  fontSize: 48,
                  fontWeight: 600,
                  opacity: p,
                  transform: `translateY(${interpolate(p, [0, 1], [16, 0])}px)`,
                }}
              >
                {m}
              </div>
            );
          })}
        </div>
      )}
      <BotonGrande texto={texto_boton} tema={tema} progreso={progresoBoton} />
      {subtexto && <div style={{ fontSize: 30, color: colorTexto, marginTop: 20, opacity: progresoBoton }}>{subtexto}</div>}
    </AbsoluteFill>
  );
}

function CtaWeb({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto_boton, subtexto } = escena.params;
  const progresoBoton = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);
  const duracionCuadros = Math.round(escena.duracion_s * fps);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      {/* display:inline-block para que el contenedor se ajuste al ancho
          real del botón (que ahora varía con el texto), y el cursor se
          ancle a su esquina de verdad. */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <BotonGrande texto={texto_boton} tema={tema} progreso={progresoBoton} />
        <CursorClic frame={frame} fps={fps} duracionCuadros={duracionCuadros} />
      </div>
      {subtexto && <div style={{ fontSize: 30, color: colorTexto, marginTop: 20, opacity: progresoBoton }}>{subtexto}</div>}
    </AbsoluteFill>
  );
}

function CampoFormulario({ etiqueta, frame, fps, inicio, tema }: { etiqueta: string; frame: number; fps: number; inicio: number; tema: TemaGuion }) {
  const progreso = spring({ frame: frame - inicio, fps, config: { damping: 14 } });
  const lleno = interpolate(frame, [inicio + fps * 0.2, inicio + fps * 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        width: "84%",
        background: "rgba(255,255,255,0.14)",
        border: `2px solid ${tema.color_secundario}`,
        borderRadius: 16,
        padding: "16px 22px",
        marginBottom: 18,
        opacity: progreso,
        transform: `translateY(${interpolate(progreso, [0, 1], [16, 0])}px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 32,
        color: colorTextoSobre(tema.color_primario),
      }}
    >
      <span style={{ opacity: 0.75 }}>{etiqueta}</span>
      {lleno >= 1 ? <span style={{ color: tema.color_secundario, fontWeight: 800 }}>✓</span> : null}
    </div>
  );
}

function CtaFormulario({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto_boton, subtexto } = escena.params;
  const cuadroBoton = fps * 1.6;
  const progresoBoton = spring({ frame: frame - cuadroBoton, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);
  const duracionCuadros = Math.round(escena.duracion_s * fps);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      <div style={{ width: "100%", marginBottom: 24 }}>
        <CampoFormulario etiqueta="Nombre" frame={frame} fps={fps} inicio={0} tema={tema} />
        <CampoFormulario etiqueta="WhatsApp" frame={frame} fps={fps} inicio={fps * 0.5} tema={tema} />
      </div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <BotonGrande texto={texto_boton} tema={tema} progreso={progresoBoton} />
        {frame >= cuadroBoton && <CursorClic frame={frame - cuadroBoton} fps={fps} duracionCuadros={duracionCuadros - cuadroBoton} />}
      </div>
      {subtexto && <div style={{ fontSize: 30, color: colorTexto, marginTop: 20, opacity: progresoBoton }}>{subtexto}</div>}
    </AbsoluteFill>
  );
}

function CtaSeguir({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto_boton, usuario, subtexto } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);
  // El botón "se presiona" cerca del final: un pequeño achique y vuelta.
  const duracionCuadros = Math.round(escena.duracion_s * fps);
  const cuadroPresion = Math.round(duracionCuadros * 0.65);
  const presion = spring({ frame: frame - cuadroPresion, fps, config: { damping: 7, mass: 0.3 } });
  const escalaBoton = 1 - Math.sin(Math.min(presion, 1) * Math.PI) * 0.08;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      {/* Tarjeta de perfil real al 70% del ancho, no solo un avatar
          suelto. */}
      <div
        style={{
          width: "70%",
          background: "rgba(255,255,255,0.14)",
          borderRadius: 32,
          padding: "44px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: progreso,
        }}
      >
        <div
          style={{
            width: 230,
            height: 230,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            border: `5px solid ${tema.color_secundario}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 26,
            flexShrink: 0,
          }}
        >
          {tema.logo_url ? (
            <Img src={tema.logo_url} style={{ width: "70%", height: "70%", objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 96 }}>👤</span>
          )}
        </div>
        {usuario && <div style={{ fontSize: 44, color: colorTexto, marginBottom: 28, fontWeight: 700 }}>{usuario}</div>}
        <div style={{ transform: `scale(${escalaBoton})`, width: "100%", display: "flex", justifyContent: "center" }}>
          <BotonGrande texto={texto_boton} tema={tema} progreso={1} />
        </div>
      </div>
      {subtexto && <div style={{ fontSize: 30, color: colorTexto, marginTop: 24, opacity: progreso }}>{subtexto}</div>}
    </AbsoluteFill>
  );
}

function CtaSuave({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto_boton, subtexto } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);
  // La frase grande de marca es subtexto (ej. "Hecho para quien trabaja
  // duro"); texto_boton ("Conócenos") queda chico debajo, sin botón --
  // en "suave" no se pide nada. Sin logo, el nombre de la marca hace de
  // respaldo (nunca queda la escena vacía).
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      {tema.logo_url ? (
        <Img src={tema.logo_url} style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 24, opacity: progreso }} />
      ) : (
        tema.nombre_marca && (
          <div style={{ fontSize: 60, fontWeight: 800, color: colorTexto, marginBottom: 24, opacity: progreso }}>{tema.nombre_marca}</div>
        )
      )}
      {subtexto && (
        <div
          style={{
            fontSize: 104,
            fontWeight: 800,
            color: colorTexto,
            textAlign: "center",
            lineHeight: 1.06,
            opacity: progreso,
            transform: `translateY(${interpolate(progreso, [0, 1], [20, 0])}px)`,
          }}
        >
          {subtexto}
        </div>
      )}
      <div style={{ fontSize: 40, color: colorTexto, marginTop: 24, opacity: progreso * 0.8, fontWeight: 600 }}>{texto_boton}</div>
    </AbsoluteFill>
  );
}

const PALABRA_COMENTAR_RESPALDO = "QUIERO";

// Caja de comentario tipo Instagram, con la palabra clave
// "escribiéndose" letra por letra -- el mismo gesto que se le pide hacer
// de verdad al espectador. Nueva (Fase O1, contenido orgánico): junto
// con "comentar" en ACCIONES_CTA, es para automatizaciones de
// "comentario a mensaje" que la marca configure, o simplemente para
// pedir opinión.
function CtaComentar({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto_boton, palabra_clave_comentario, subtexto } = escena.params;
  const palabra = palabra_clave_comentario || PALABRA_COMENTAR_RESPALDO;
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);
  const cuadroInicioEscritura = fps * 0.4;
  const letrasVisibles = Math.floor(
    interpolate(frame, [cuadroInicioEscritura, cuadroInicioEscritura + fps * 0.8], [0, palabra.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const terminoDeEscribir = letrasVisibles >= palabra.length;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      <div style={{ fontSize: 54, fontWeight: 800, color: colorTexto, textAlign: "center", marginBottom: 32, opacity: progreso }}>{texto_boton}</div>
      <div
        style={{
          width: "90%",
          background: "rgba(255,255,255,0.95)",
          borderRadius: 999,
          padding: "22px 36px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: progreso,
          transform: `scale(${progreso})`,
        }}
      >
        <span style={{ fontSize: 40 }}>💬</span>
        <span style={{ fontSize: 42, fontWeight: 800, color: "#111" }}>
          {palabra.slice(0, letrasVisibles)}
          <span style={{ opacity: terminoDeEscribir ? 0 : 1 }}>|</span>
        </span>
      </div>
      {subtexto && <div style={{ fontSize: 30, color: colorTexto, marginTop: 24, opacity: progreso }}>{subtexto}</div>}
    </AbsoluteFill>
  );
}

export function Cta(props: PropsEscena<"cta">) {
  const { tema, escena } = props;
  return (
    <AbsoluteFill>
      <FondoMarca tema={tema} tono="marca" />
      {escena.params.accion === "whatsapp" && <CtaWhatsapp {...props} />}
      {escena.params.accion === "web" && <CtaWeb {...props} />}
      {escena.params.accion === "formulario" && <CtaFormulario {...props} />}
      {escena.params.accion === "seguir" && <CtaSeguir {...props} />}
      {escena.params.accion === "suave" && <CtaSuave {...props} />}
      {escena.params.accion === "comentar" && <CtaComentar {...props} />}
    </AbsoluteFill>
  );
}
