// Visual "anuncio simulado sin botón -> aparece el botón y el cursor
// hace clic" (escena 1/3 del bloque valor, pedido explícito del
// usuario: "cada razón es su propia escena visual con problema ->
// arreglo", no una lista de texto).
import { interpolate, spring } from "remotion";
import { colorTextoSobre, mezclarColoresHex, type TemaGuion } from "../../../../tema";
import { CursorClicGenerico } from "./CursorClicGenerico";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

export function AnuncioBoton({
  frame,
  fps,
  tema,
  cuadroCorte,
  duracionCuadros,
  escalaCamara = 1,
}: {
  frame: number;
  fps: number;
  tema: TemaGuion;
  cuadroCorte: number;
  duracionCuadros: number;
  escalaCamara?: number;
}) {
  const activa = frame >= cuadroCorte;
  const progreso = spring({ frame: frame - cuadroCorte, fps, config: { damping: 13 } });
  const colorTextoBoton = colorTextoSobre(tema.color_primario);

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: `translateX(-50%) scale(${escalaCamara})`,
        background: "#fff",
        borderRadius: 32,
        boxShadow: activa ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Imagen del anuncio simulado -- el ícono grande evita que se lea
          como un bloque de color vacío (pedido explícito: "nada de
          grandes áreas vacías"). */}
      <div
        style={{
          flexGrow: 1,
          background: `linear-gradient(145deg, ${mezclarColoresHex(tema.color_primario, tema.color_secundario, 0.4)}, ${tema.color_secundario})`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <span style={{ position: "absolute", top: 24, left: 24, background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 28, fontWeight: 700, padding: "10px 20px", borderRadius: 999 }}>📣 Anuncio</span>
        <span style={{ fontSize: 150, opacity: 0.5, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.2))" }}>👟</span>
      </div>
      {/* Pie: caption + botón */}
      <div style={{ padding: "26px 30px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#333" }}>Zapatos cómodos · outlet -40%</div>
        {!activa ? (
          <div
            style={{
              border: `3px dashed ${COLOR_ALERTA}`,
              borderRadius: 16,
              padding: "20px 0",
              textAlign: "center",
              color: COLOR_ALERTA,
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            Sin botón de contacto
          </div>
        ) : (
          // Ancho fijo y generoso (no fit-content): con el botón angosto
          // de antes, el cursor (que se ancla por porcentaje al tamaño
          // del botón) terminaba encima del propio texto "Enviar mensaje"
          // -- ajuste explícito del usuario.
          <div style={{ position: "relative", width: "100%" }}>
            <div
              style={{
                background: colorTextoBoton,
                color: colorTextoSobre(colorTextoBoton),
                borderRadius: 999,
                padding: "24px 0",
                width: "100%",
                textAlign: "center",
                fontSize: 36,
                fontWeight: 800,
                transform: `scale(${interpolate(progreso, [0, 1], [0.85, 1])})`,
                opacity: progreso,
              }}
            >
              Enviar mensaje
            </div>
            <CursorClicGenerico frame={frame - cuadroCorte} fps={fps} duracionCuadros={duracionCuadros - cuadroCorte} />
          </div>
        )}
      </div>
    </div>
  );
}
