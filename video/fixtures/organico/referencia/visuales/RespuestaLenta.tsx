// Visual "chat con 'visto' y reloj corriendo -> respuesta inmediata y
// el cliente dice 'Perfecto, lo quiero'" (escena 3/3 del bloque valor).
//
// v3 (ajuste explícito del usuario): la tarjeta se sentía vacía en la
// fase de problema -- ahora el reloj es GRANDE y corre por 3 valores
// reales (00:05 -> 02:30 -> 15:00), no un ícono chico de adorno, y las
// burbujas son más grandes.
import { interpolate, spring } from "remotion";
import { respiracion, type TemaGuion } from "../../../../tema";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

// mm:ss -- 5s, 2:30 y 15:00 son los 3 valores pedidos explícitamente,
// como puntos de paso de una interpolación (no un conteo real en vivo).
function formatoReloj(totalSegundos: number): string {
  const m = Math.floor(totalSegundos / 60);
  const s = Math.floor(totalSegundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RespuestaLenta({
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
  const rapida = frame >= cuadroCorte;
  const cuadroRespuesta = cuadroCorte;
  const cuadroConfirmacion = cuadroCorte + Math.round(fps * 0.3);
  const progresoRespuesta = spring({ frame: frame - cuadroRespuesta, fps, config: { damping: 16, stiffness: 300 } });
  const progresoConfirmacion = spring({ frame: frame - cuadroConfirmacion, fps, config: { damping: 16, stiffness: 300 } });
  const escalaRespiracion = respiracion(frame, fps);

  const segundosReloj = interpolate(frame, [0, cuadroCorte * 0.5, cuadroCorte], [5, 150, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rotacionReloj = rapida ? 0 : Math.sin(frame / 6) * 10;

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: `translateX(-50%) scale(${escalaCamara * escalaRespiracion})`,
        background: "#0a0a0a",
        borderRadius: 36,
        padding: "10px 10px 0 10px",
        boxShadow: rapida ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: "26px 26px 0 0", overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column", padding: "30px 28px", gap: 20 }}>
        <div style={{ background: "#f0f0f0", color: "#111", borderRadius: "24px 24px 24px 6px", padding: "24px 30px", fontSize: 44, fontWeight: 700, alignSelf: "flex-start", maxWidth: "90%" }}>
          Hola, ¿tienen disponible?
        </div>

        {!rapida && (
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: COLOR_ALERTA }}>Visto</span>
              <span style={{ fontSize: 30, color: COLOR_ALERTA }}>✓✓</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 68, display: "inline-block", transform: `rotate(${rotacionReloj}deg)` }}>🕐</span>
              <span style={{ fontSize: 92, fontWeight: 900, color: COLOR_ALERTA, fontVariantNumeric: "tabular-nums" }}>{formatoReloj(segundosReloj)}</span>
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#999" }}>sin responder...</span>
          </div>
        )}

        {rapida && (
          <>
            <div
              style={{
                background: COLOR_EXITO,
                color: "#fff",
                borderRadius: "24px 24px 6px 24px",
                padding: "24px 30px",
                fontSize: 44,
                fontWeight: 700,
                alignSelf: "flex-end",
                maxWidth: "90%",
                opacity: progresoRespuesta,
                transform: `translateY(${interpolate(progresoRespuesta, [0, 1], [16, 0])}px)`,
              }}
            >
              ¡Sí, aquí tienes! 😊
            </div>
            <div
              style={{
                background: "#f0f0f0",
                color: "#111",
                borderRadius: "24px 24px 24px 6px",
                padding: "24px 30px",
                fontSize: 44,
                fontWeight: 700,
                alignSelf: "flex-start",
                maxWidth: "90%",
                opacity: progresoConfirmacion,
                transform: `translateY(${interpolate(progresoConfirmacion, [0, 1], [16, 0])}px)`,
              }}
            >
              Perfecto, lo quiero
            </div>
          </>
        )}
      </div>
    </div>
  );
}
