// Promovido tal cual (mismas proporciones, ya usaba las constantes
// compartidas) desde video/fixtures/organico/referencia/visuales/
// RespuestaLenta.tsx (Fase A, aprobado) -- agregado el 16 nov 2026
// (3ra revisión de staging), mismo motivo que AnuncioBotonVisual.tsx:
// muestra el consejo "responde rápido" con un antes (reloj corriendo,
// "visto") y un después (respuesta + confirmación) real.
import { interpolate, spring } from "remotion";
import { respiracion } from "../tema";
import { interpolarSeguro } from "../interpolarSeguro";
import { COLOR_EXITO, COLOR_EXITO_BLOQUE } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";
import { IconoDobleCheck, IconoReloj } from "../iconos";
import { useSuperficie } from "../estilos/superficie";

// mm:ss -- 5s, 2:30 y 15:00 son puntos de paso de una interpolación
// (no un conteo real en vivo), igual que en la referencia aprobada.
function formatoReloj(totalSegundos: number): string {
  const m = Math.floor(totalSegundos / 60);
  const s = Math.floor(totalSegundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Textos (parte 2b): la pregunta real que hace un cliente de ESE rubro,
// la respuesta del negocio y la confirmación del cliente.
export const TEXTOS_RESPUESTA_POR_DEFECTO = { pregunta_cliente: "Hola, ¿tienen disponible?", respuesta: "¡Sí, aquí tienes!", confirmacion: "Perfecto, lo quiero" };

export function RespuestaLentaVisual({
  frame,
  fps,
  cuadroCambia,
  textos = {},
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  textos?: { pregunta_cliente?: string; respuesta?: string; confirmacion?: string };
}) {
  const t = { ...TEXTOS_RESPUESTA_POR_DEFECTO, ...Object.fromEntries(Object.entries(textos).filter(([, v]) => !!v)) };
  const rapida = frame >= cuadroCambia;
  const cuadroConfirmacion = cuadroCambia + Math.round(fps * 0.3);
  const progresoRespuesta = spring({ frame: frame - cuadroCambia, fps, config: { damping: 16, stiffness: 300 } });
  const progresoConfirmacion = spring({ frame: frame - cuadroConfirmacion, fps, config: { damping: 16, stiffness: 300 } });
  const escalaRespiracion = respiracion(frame, fps);

  const segundosReloj = interpolarSeguro(frame, [0, Math.max(cuadroCambia * 0.5, 1), Math.max(cuadroCambia, 2)], [5, 150, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rotacionReloj = rapida ? 0 : Math.sin(frame / 6) * 10;
  const s = useSuperficie();
  const alerta = s.alerta;

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: `translateX(-50%) scale(${escalaRespiracion})`,
        background: s.marco,
        border: s.borde ? `5px solid ${s.borde}` : undefined,
        borderRadius: 32,
        padding: "8px 8px 0 8px",
        boxShadow: rapida ? `${s.sombra}, 0 0 0 6px ${COLOR_EXITO}55` : s.sombra,
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: "22px 22px 0 0", overflow: "hidden", background: s.tarjeta, display: "flex", flexDirection: "column", padding: "20px 22px", gap: 14 }}>
        <div data-estable="respuesta-pregunta" style={{ background: s.burbuja, color: s.textoBurbuja, borderRadius: "20px 20px 20px 5px", padding: "16px 22px", fontSize: 40, fontWeight: 700, alignSelf: "flex-start", maxWidth: "90%" }}>
          {t.pregunta_cliente}
        </div>

        {!rapida && (
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: alerta }}>Visto</span>
              <IconoDobleCheck tamano={40} color={alerta} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <IconoReloj tamano={56} color={alerta} estilo={{ transform: `rotate(${rotacionReloj}deg)` }} />
              <span style={{ fontSize: 64, fontWeight: 900, color: alerta, fontVariantNumeric: "tabular-nums" }}>{formatoReloj(segundosReloj)}</span>
            </div>
            <span style={{ fontSize: 40, fontWeight: 700, color: s.textoSuave }}>sin responder...</span>
          </div>
        )}

        {rapida && (
          <>
            <div
              style={{
                // Verde de bloque (5,43:1 con blanco); el verde de WhatsApp
                // daba 1,98:1 con el texto blanco encima.
                background: COLOR_EXITO_BLOQUE,
                color: "#fff",
                borderRadius: "20px 20px 5px 20px",
                padding: "16px 22px",
                fontSize: 40,
                fontWeight: 700,
                alignSelf: "flex-end",
                maxWidth: "90%",
                opacity: progresoRespuesta,
                transform: `translateY(${interpolate(progresoRespuesta, [0, 1], [16, 0])}px)`,
              }}
            >
              {t.respuesta}
            </div>
            <div
              style={{
                background: s.burbuja,
                color: s.textoBurbuja,
                borderRadius: "20px 20px 20px 5px",
                padding: "16px 22px",
                fontSize: 40,
                fontWeight: 700,
                alignSelf: "flex-start",
                maxWidth: "90%",
                opacity: progresoConfirmacion,
                transform: `translateY(${interpolate(progresoConfirmacion, [0, 1], [16, 0])}px)`,
              }}
            >
              {t.confirmacion}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
