// Visual "anuncio y celular grandes, unidos por una línea gruesa que se
// corta en rojo y luego se conecta en verde, con el mensaje viajando
// por la línea hasta el celular" (escena 2/3 del bloque valor, v3 --
// reemplaza la v2, que tenía un chip de anuncio chico y una línea
// delgada). Conector SIEMPRE position:absolute (ver
// feedback_flex_shrink_conector_vacio en memoria): un div decorativo
// sin contenido propio, puesto como hijo normal de un flex-column, se
// comprime a 0 -- ya pasó una vez en este mismo reel.
import { interpolate, spring } from "remotion";
import { respiracion, type TemaGuion } from "../../../../tema";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";

export function ConexionWhatsapp({
  frame,
  fps,
  tema,
  cuadroCorte,
  escalaCamara = 1,
}: {
  frame: number;
  fps: number;
  tema: TemaGuion;
  cuadroCorte: number;
  escalaCamara?: number;
}) {
  const conectado = frame >= cuadroCorte;
  const progresoMensaje = spring({ frame: frame - cuadroCorte, fps, config: { damping: 14 } });
  // El mensaje "viaja" por la línea justo en el momento de la conexión,
  // antes de aparecer como burbuja real adentro del celular.
  const progresoViaje = interpolate(frame, [cuadroCorte, cuadroCorte + Math.round(fps * 0.35)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const escalaRespiracion = respiracion(frame, fps);
  const color = conectado ? COLOR_EXITO : COLOR_ALERTA;

  return (
    <div style={{ position: "absolute", inset: 0, transform: `scale(${escalaRespiracion})` }}>
      {/* Anuncio, arriba -- grande, no un chip chico. */}
      <div
        style={{
          position: "absolute",
          top: "24%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "68%",
          height: "15%",
          borderRadius: 24,
          background: `linear-gradient(145deg, ${tema.color_primario}, ${tema.color_secundario})`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 90 }}>📣</span>
        <span
          style={{
            position: "absolute",
            top: 14,
            left: 18,
            background: "rgba(0,0,0,0.3)",
            color: "#fff",
            fontSize: 22,
            fontWeight: 700,
            padding: "6px 16px",
            borderRadius: 999,
          }}
        >
          Anuncio
        </span>
      </div>

      {/* Línea gruesa: cortada (2 tramos + ✗ grande) o conectada (1 sola,
          con el mensaje viajando por encima). */}
      {!conectado ? (
        <>
          <div style={{ position: "absolute", top: "39%", left: "50%", transform: "translateX(-50%)", width: 16, height: "3%", background: color, borderRadius: 8 }} />
          <div style={{ position: "absolute", top: "44%", left: "50%", transform: "translateX(-50%)", width: 16, height: "2%", background: color, borderRadius: 8 }} />
          <div
            style={{
              position: "absolute",
              top: "41%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: color,
              color: "#fff",
              fontSize: 54,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 26px rgba(0,0,0,0.4)",
            }}
          >
            ✗
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", top: "39%", left: "50%", transform: "translateX(-50%)", width: 16, height: "7%", background: color, borderRadius: 8 }} />
          {/* El mensaje viajando: un puntito que baja por la línea. */}
          <div
            style={{
              position: "absolute",
              top: `${interpolate(progresoViaje, [0, 1], [39, 45])}%`,
              left: "50%",
              transform: "translateX(-50%)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#fff",
              opacity: interpolate(progresoViaje, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            }}
          />
        </>
      )}

      {/* Celular, abajo -- grande. */}
      <div
        style={{
          position: "absolute",
          top: "47%",
          left: "50%",
          width: "80%",
          height: "22%",
          transform: `translateX(-50%) scale(${escalaCamara})`,
          background: "#0a0a0a",
          borderRadius: 36,
          padding: "10px 10px 0 10px",
          boxShadow: conectado ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: "26px 26px 0 0", overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
          {conectado ? (
            <div
              style={{
                background: "#f0f0f0",
                color: "#111",
                borderRadius: "24px 24px 24px 6px",
                padding: "24px 30px",
                fontSize: 42,
                fontWeight: 700,
                opacity: progresoMensaje,
                transform: `translateY(${interpolate(progresoMensaje, [0, 1], [16, 0])}px)`,
              }}
            >
              Hola, ¿tienen disponible?
            </div>
          ) : (
            <span style={{ fontSize: 52, fontWeight: 800, color: COLOR_ALERTA }}>Sin conexión</span>
          )}
        </div>
      </div>
    </div>
  );
}
