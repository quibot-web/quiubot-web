// Visual de 2 estados "foto mal -> foto bien" con una foto REAL del álbum
// de la marca (parte 2d, 18 nov 2026). Promovido y generalizado desde la
// referencia aprobada video/fixtures/organico/referencia/visuales/
// ComparacionFoto.tsx (mismos valores de blur/brillo, ya verificados en
// el render real): "antes" la foto oscura y borrosa con la franja ❌
// texto_mal; "después" la foto nítida con la franja ✔️ texto_bien.
//
// La foto sale SIEMPRE de las piezas elegidas para la pieza (media_id
// validado en generarGuionConVoz contra entrada.piezas, solo imágenes),
// nunca de un stock. Si en el render no llega el medio resuelto, se
// muestra una tarjeta neutra con 🖼️ -- nunca un recuadro roto.
//
// Capas por orden de DOM, nunca z-index (no lo soporta
// @remotion/web-renderer, nota de la referencia).
import { Img, interpolate, spring } from "remotion";
import { COLOR_ALERTA, COLOR_EXITO, COLOR_EXITO_BLOQUE } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";
import { IconoImagen, IconoMarca } from "../iconos";

export function ComparacionFotoVisual({
  frame,
  fps,
  cuadroCambia,
  urlFoto,
  textoMal,
  textoBien,
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  urlFoto: string | null;
  textoMal: string;
  textoBien: string;
}) {
  const nitida = frame >= cuadroCambia;
  const progreso = nitida ? spring({ frame: frame - cuadroCambia, fps, config: { damping: 14 } }) : 0;
  const borrosidad = interpolate(progreso, [0, 1], [10, 0]);
  const brillo = interpolate(progreso, [0, 1], [0.45, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: "translateX(-50%)",
        background: "#111",
        borderRadius: 32,
        boxShadow: nitida ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      {urlFoto ? (
        <Img
          src={urlFoto}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: `blur(${borrosidad}px) brightness(${brillo})` }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#2a2a2a" }}>
          <IconoImagen tamano={120} color="#777" />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 20,
          background: "#fff",
          borderRadius: 20,
          border: `5px solid ${nitida ? COLOR_EXITO : COLOR_ALERTA}`,
          padding: "14px 22px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <IconoMarca tipo={nitida ? "bien" : "mal"} tamano={38} />
        <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, color: nitida ? COLOR_EXITO_BLOQUE : COLOR_ALERTA }}>{nitida ? textoBien : textoMal}</span>
      </div>
    </div>
  );
}
