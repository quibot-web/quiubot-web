import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre } from "../tema";
import { FondoMarca } from "../capas/FondoMarca";
import type { PropsEscena } from "./tipos";
import type { TemaGuion } from "../tema";

const COLOR_WHATSAPP = "#25D366";
const ANCHO_BOTON = "66%";

// El botón NUNCA usa el secundario de la marca como relleno: si el
// secundario queda parecido al primario (fondos de la misma familia de
// color, caso real: "retargeting" con primario y secundario teal), el
// botón se funde con el fondo. Con blanco/casi negro -- el que mejor
// contraste contra el fondo real -- el botón resalta siempre, sin
// importar la paleta de marca.
function BotonGrande({ texto, tema, progreso }: { texto: string; tema: TemaGuion; progreso: number }) {
  const colorBoton = colorTextoSobre(tema.color_primario);
  const colorTexto = colorTextoSobre(colorBoton);
  return (
    <div
      style={{
        width: ANCHO_BOTON,
        background: colorBoton,
        color: colorTexto,
        borderRadius: 999,
        padding: "26px 0",
        fontSize: 58,
        fontWeight: 800,
        textAlign: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        transform: `scale(${progreso})`,
      }}
    >
      {texto}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36, alignSelf: "flex-start" }}>
          {mensajes.map((m, i) => {
            const p = spring({ frame: frame - i * 8, fps, config: { damping: 14 } });
            return (
              <div
                key={i}
                style={{
                  background: COLOR_WHATSAPP,
                  color: "#fff",
                  borderRadius: "22px 22px 22px 4px",
                  padding: "16px 24px",
                  fontSize: 36,
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

  // El cursor entra desde abajo-derecha y "hace clic" (se achica) justo
  // encima del botón, a mitad de la escena.
  const duracionCuadros = Math.round(escena.duracion_s * fps);
  const cuadroClic = Math.round(duracionCuadros * 0.6);
  const llegada = interpolate(frame, [fps * 0.3, cuadroClic], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clic = spring({ frame: frame - cuadroClic, fps, config: { damping: 6, mass: 0.4 } });
  const escalaCursor = 1 - Math.sin(Math.min(clic, 1) * Math.PI) * 0.3;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      {/* position:relative para que el cursor se ancle al botón mismo
          (abajo-derecha de su caja real), no a un punto adivinado de la
          pantalla completa. */}
      <div style={{ position: "relative", width: ANCHO_BOTON }}>
        <BotonGrande texto={texto_boton} tema={tema} progreso={progresoBoton} />
        <div
          style={{
            position: "absolute",
            fontSize: 70,
            right: `${interpolate(llegada, [0, 1], [-30, 6])}%`,
            bottom: `${interpolate(llegada, [0, 1], [-60, -18])}%`,
            transform: `scale(${escalaCursor}) rotate(-20deg)`,
            opacity: interpolate(frame, [0, fps * 0.2], [0, 1], { extrapolateRight: "clamp" }),
            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
          }}
        >
          👆
        </div>
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

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      <div style={{ width: "100%", marginBottom: 24 }}>
        <CampoFormulario etiqueta="Nombre" frame={frame} fps={fps} inicio={0} tema={tema} />
        <CampoFormulario etiqueta="WhatsApp" frame={frame} fps={fps} inicio={fps * 0.5} tema={tema} />
      </div>
      <BotonGrande texto={texto_boton} tema={tema} progreso={progresoBoton} />
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
      <div
        style={{
          width: 170,
          height: 170,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.18)",
          border: `4px solid ${tema.color_secundario}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          opacity: progreso,
        }}
      >
        {tema.logo_url ? (
          <Img src={tema.logo_url} style={{ width: "70%", height: "70%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 70 }}>👤</span>
        )}
      </div>
      {usuario && <div style={{ fontSize: 40, color: colorTexto, marginBottom: 22, opacity: progreso, fontWeight: 600 }}>{usuario}</div>}
      <div style={{ transform: `scale(${escalaBoton})` }}>
        <BotonGrande texto={texto_boton} tema={tema} progreso={progreso} />
      </div>
      {subtexto && <div style={{ fontSize: 30, color: colorTexto, marginTop: 20, opacity: progreso }}>{subtexto}</div>}
    </AbsoluteFill>
  );
}

function CtaSuave({ escena, tema }: PropsEscena<"cta">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { texto_boton, subtexto } = escena.params;
  const progreso = spring({ frame, fps, config: { damping: 12 } });
  const colorTexto = colorTextoSobre(tema.color_primario);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
      {tema.logo_url && (
        <Img src={tema.logo_url} style={{ width: 180, height: 180, objectFit: "contain", marginBottom: 26, opacity: progreso }} />
      )}
      <div
        style={{
          fontSize: 76,
          fontWeight: 800,
          color: colorTexto,
          textAlign: "center",
          opacity: progreso,
          transform: `translateY(${interpolate(progreso, [0, 1], [20, 0])}px)`,
        }}
      >
        {texto_boton}
      </div>
      {subtexto && <div style={{ fontSize: 34, color: colorTexto, marginTop: 16, opacity: progreso * 0.85 }}>{subtexto}</div>}
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
    </AbsoluteFill>
  );
}
