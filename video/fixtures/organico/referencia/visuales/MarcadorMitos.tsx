// "Marcador" que cierra el bucle respondiendo la pregunta del gancho
// (pedido explícito: "que cierre el bucle... por ejemplo '2 de 2:
// mitos ✗', y no repita la tarjeta del presupuesto"). v3: recuadro
// sólido naranja + texto blanco (mismo motivo que TitularMitoVerdad --
// blanco directo sobre el degradado de marca no llegaba a 4.5:1 de
// contraste). Cuenta de 0 al total en vez de aparecer ya resuelto, para
// que nada se quede quieto.
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { respiracion } from "../../../../tema";
import { COLOR_ALERTA_BLOQUE } from "./acento";

export function MarcadorMitos({ total }: { total: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const escalaRespiracion = respiracion(frame, fps);
  const valorMostrado = Math.round(interpolate(frame, [0, Math.round(fps * 0.8)], [0, total], { extrapolateRight: "clamp" }));

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: COLOR_ALERTA_BLOQUE,
          borderRadius: 36,
          padding: "50px 56px",
          textAlign: "center",
          boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          transform: `scale(${escalaRespiracion})`,
        }}
      >
        <div style={{ fontSize: 220, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{valorMostrado}</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "#fff", marginTop: 10 }}>de {total} eran mito ✗</div>
      </div>
    </div>
  );
}
