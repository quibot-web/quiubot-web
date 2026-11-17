// Promovido y generalizado desde
// video/fixtures/organico/referencia/visuales/AnuncioBoton.tsx (Fase A,
// aprobado) -- agregado el 16 nov 2026 (3ra revisión de staging): con
// solo boton_estado/cursor_clic/contador, la IA no tenía cómo MOSTRAR
// el consejo "pon un botón de contacto en tu anuncio" -- un botón
// suelto sin el "antes" (el anuncio sin botón) no es un problema->
// arreglo, es una afirmación sin mostrar nada.
//
// Generalizado respecto al original: la referencia tenía "Zapatos
// cómodos · outlet -40%" y un emoji de tenis -- texto/producto FALSO,
// específico de un demo. Acá el anuncio simulado es genérico (un
// megáfono grande, sin inventar un producto ni una oferta de la marca
// real) -- lo que cambia es el botón, que es lo que el consejo
// enseña.
import { interpolate, spring } from "remotion";
import { colorTextoSobre, mezclarColoresHex, type TemaGuion } from "../tema";
import { CursorClicEventos } from "./CursorClicEventos";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

export function AnuncioBotonVisual({ frame, fps, tema, cuadroCambia }: { frame: number; fps: number; tema: TemaGuion; cuadroCambia: number }) {
  const activa = frame >= cuadroCambia;
  const progreso = spring({ frame: frame - cuadroCambia, fps, config: { damping: 13 } });
  // Bug real (ronda H, revisión de staging): colorTextoSobre(primario)
  // da un color de TEXTO con contraste contra el primario -- usarlo
  // como fondo del botón lo dejaba casi blanco sobre la tarjeta blanca
  // (invisible, se leía como texto suelto). Mismo bug y misma fórmula
  // de arreglo que ya tiene BotonEstado.tsx: el color de marca real
  // como fondo, el color de contraste como texto encima de ESE fondo.
  const colorBoton = tema.color_primario;
  const colorTextoBoton = colorTextoSobre(colorBoton);

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: "translateX(-50%)",
        background: "#fff",
        borderRadius: 32,
        boxShadow: activa ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
        <span style={{ position: "absolute", top: 20, left: 20, background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 24, fontWeight: 700, padding: "8px 18px", borderRadius: 999 }}>📣 Anuncio</span>
        <span style={{ fontSize: 110, opacity: 0.6, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.2))" }}>📣</span>
      </div>
      <div style={{ padding: "22px 26px" }}>
        {!activa ? (
          <div
            style={{
              border: `3px dashed ${COLOR_ALERTA}`,
              borderRadius: 16,
              padding: "16px 0",
              textAlign: "center",
              color: COLOR_ALERTA,
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            Sin botón de contacto
          </div>
        ) : (
          // Ancho fijo y generoso (no fit-content) -- mismo ajuste de la
          // referencia: con un botón angosto, el cursor (anclado por
          // porcentaje al tamaño del botón) terminaba encima del texto.
          <div style={{ position: "relative", width: "100%" }}>
            <div
              style={{
                background: colorBoton,
                color: colorTextoBoton,
                borderRadius: 999,
                padding: "20px 0",
                width: "100%",
                textAlign: "center",
                fontSize: 32,
                fontWeight: 800,
                transform: `scale(${interpolate(progreso, [0, 1], [0.85, 1])})`,
                opacity: progreso,
              }}
            >
              Enviar mensaje
            </div>
            <CursorClicEventos frame={frame} fps={fps} cuadroAparece={cuadroCambia} cuadroClic={cuadroCambia + Math.round(fps * 0.25)} />
          </div>
        )}
      </div>
    </div>
  );
}
