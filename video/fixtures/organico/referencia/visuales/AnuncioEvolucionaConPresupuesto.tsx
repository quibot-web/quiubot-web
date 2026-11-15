// Visual del mito 1 (v2, reescrito -- la v1 mostraba la barra de
// presupuesto BAJANDO mientras los mensajes subían, que se lee como
// "gasta menos y vende más": un mensaje falso, al revés de la verdad
// real. Ahora el presupuesto queda FIJO (nunca cambia, a propósito --
// ese es el punto del mito) y lo que cambia es el ANUNCIO mismo (de
// flojo a bueno: aparece el botón, mejora el texto) con el MISMO
// presupuesto -- los mensajes suben porque el anuncio mejoró, no porque
// cambió la plata.
//
// No reusa AnuncioBoton.tsx (el visual real del Reel 1, ya aprobado) a
// propósito -- este visual necesita la franja de presupuesto fija
// arriba, que AnuncioBoton no tiene, y el Reel 1 no debe arriesgarse
// por un cambio pensado para el Reel 2.
import { interpolate, spring } from "remotion";
import { colorTextoSobre, mezclarColoresHex, type TemaGuion } from "../../../../tema";
import { CursorClicGenerico } from "./CursorClicGenerico";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

const NIVEL_PRESUPUESTO_FIJO = 55;
const MENSAJES_FLOJO = 1;
const MENSAJES_BUENO = 6;

export function AnuncioEvolucionaConPresupuesto({
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
  const bueno = frame >= cuadroCorte;
  const progreso = spring({ frame: frame - cuadroCorte, fps, config: { damping: 13 } });
  const colorTextoBoton = colorTextoSobre(tema.color_primario);
  const colorAcento = bueno ? COLOR_EXITO : COLOR_ALERTA;
  const mensajes = bueno ? Math.round(interpolate(progreso, [0, 1], [MENSAJES_FLOJO, MENSAJES_BUENO])) : MENSAJES_FLOJO;

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
        boxShadow: bueno ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Presupuesto: FIJO siempre -- gris neutro, nunca rojo ni verde,
          para que quede claro que esto NO es lo que cambia. */}
      <div style={{ padding: "22px 30px 18px", display: "flex", flexDirection: "column", gap: 10, borderBottom: "2px solid #f2f2f2" }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "#999" }}>💰 Mismo presupuesto en las dos</span>
        <div style={{ width: "100%", height: 20, borderRadius: 10, background: "#eee", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${NIVEL_PRESUPUESTO_FIJO}%`, background: "#aaa", borderRadius: 10 }} />
        </div>
      </div>
      {/* Imagen del anuncio simulado */}
      <div
        style={{
          flexGrow: 1,
          background: `linear-gradient(145deg, ${mezclarColoresHex(tema.color_primario, tema.color_secundario, 0.4)}, ${tema.color_secundario})`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ position: "absolute", top: 20, left: 20, background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 24, fontWeight: 700, padding: "8px 18px", borderRadius: 999 }}>📣 Anuncio</span>
        <span style={{ fontSize: 130, opacity: 0.5, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.2))" }}>👟</span>
      </div>
      {/* Pie: caption + mensajes + botón */}
      <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#333" }}>{bueno ? "Zapatos cómodos · envío gratis hoy" : "Zapatos"}</span>
          <span style={{ fontSize: 44, fontWeight: 900, color: colorAcento }}>{mensajes}</span>
        </div>
        {!bueno ? (
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
          <div style={{ position: "relative", width: "100%" }}>
            <div
              style={{
                background: colorTextoBoton,
                color: colorTextoSobre(colorTextoBoton),
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
            <CursorClicGenerico frame={frame - cuadroCorte} fps={fps} duracionCuadros={duracionCuadros - cuadroCorte} />
          </div>
        )}
      </div>
    </div>
  );
}
