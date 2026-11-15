// Visual "foto borrosa -> foto nítida" (mito: "cualquier foto sirve" ->
// verdad: "una foto real y clara de tu producto vende más"). Pedido
// explícito, v2: una foto de PRODUCTO DE VERDAD, no un emoji -- v3
// (ajuste explícito del usuario): la primera foto (un tenis) tenía el
// logo y el swoosh de Nike visibles, riesgo de marca registrada. Ahora
// es public/demo-organico/foto-producto-ceramica.jpg -- una vasija de
// cerámica genérica, SIN ningún logo ni marca visible (foto de stock
// libre, licencia Unsplash, descargada para esta referencia; en un
// reel de un cliente real esto sale del álbum real de la marca, nunca
// de un stock -- ver la regla agregada al plan de la Fase B).
// filter:blur()/brightness() -- brightness() ya está confirmado
// funcionando en este proyecto real (capas/FondoMarca.tsx la usa para
// oscurecer la imagen de fondo); blur() se verificó en el render real
// de este mismo reel antes de confiar en él.
import { Img, interpolate, spring, staticFile } from "remotion";
import { respiracion, type TemaGuion } from "../../../../tema";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

const MENSAJES_MITO = 2;
const MENSAJES_VERDAD = 6;
const FOTO_PRODUCTO = staticFile("demo-organico/foto-producto-ceramica.jpg");

export function ComparacionFoto({
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
  const nitida = frame >= cuadroCorte;
  const progreso = spring({ frame: frame - cuadroCorte, fps, config: { damping: 14 } });
  const borrosidad = interpolate(progreso, [0, 1], [10, 0]);
  const brillo = interpolate(progreso, [0, 1], [0.45, 1]);
  const mensajes = nitida ? Math.round(interpolate(progreso, [0, 1], [MENSAJES_MITO, MENSAJES_VERDAD])) : MENSAJES_MITO;
  const color = nitida ? COLOR_EXITO : COLOR_ALERTA;
  const escalaRespiracion = respiracion(frame, fps);

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: `translateX(-50%) scale(${escalaCamara * escalaRespiracion})`,
        background: "#111",
        borderRadius: 32,
        boxShadow: nitida ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      <Img
        src={FOTO_PRODUCTO}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: `blur(${borrosidad}px) brightness(${brillo})`,
        }}
      />
      {/* Franja de mensajes, encima de la foto (orden de DOM, no
          z-index -- no soportado por @remotion/web-renderer). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "26px 30px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.65), rgba(0,0,0,0))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 34, fontWeight: 700, color: "#fff" }}>💬 mensajes</span>
        <span style={{ fontSize: 68, fontWeight: 900, color, lineHeight: 1 }}>{mensajes}</span>
      </div>
    </div>
  );
}
