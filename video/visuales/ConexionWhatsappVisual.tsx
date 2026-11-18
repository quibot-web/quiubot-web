// Promovido desde video/fixtures/organico/referencia/visuales/
// ConexionWhatsapp.tsx (Fase A, aprobado) -- agregado el 16 nov 2026
// (3ra revisión de staging), mismo motivo que AnuncioBotonVisual.tsx:
// muestra el consejo "conecta tu anuncio a WhatsApp" con un antes
// (línea cortada, ✗) y un después (conectada, el mensaje viaja hasta
// el celular) real, no un botón suelto.
//
// Reescalado respecto al original: la referencia posicionaba el
// anuncio y el celular con porcentajes ABSOLUTOS de toda la pantalla
// (24%-69%) -- ahí cabía porque esos reels no tenían subtítulos
// (franja 54%-65% reservada, ver SubtitulosSincronizados.tsx). Acá
// todo vive dentro de un contenedor con la MISMA altura que
// TarjetaSimple/ZonaVisual (TARJETA_TOP_PORCENTAJE a TARJETA_TOP+ALTURA),
// y los 2 elementos (anuncio arriba, celular abajo) se reparten ESE
// espacio en vez de la pantalla completa -- conector SIEMPRE
// position:absolute (ver feedback_flex_shrink_conector_vacio en
// memoria).
import { AbsoluteFill, interpolate, spring } from "remotion";
import { respiracion, type TemaGuion } from "../tema";
import { interpolarSeguro } from "../interpolarSeguro";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";
import { IconoCruz } from "../iconos";
import { IconoCatalogo } from "../iconosCatalogo";

// Textos (parte 2b): "etiqueta" es el origen (anuncio, perfil, catálogo,
// historia...), "texto_problema" lo que pasa mientras está desconectado,
// "mensaje" lo que llega al chat al conectarse.
// Sin "icono" en el guion se dibuja el megáfono del catálogo.
export const TEXTOS_CONEXION_POR_DEFECTO = { icono: undefined as string | undefined, etiqueta: "Anuncio", texto_problema: "Sin conexión", mensaje: "Hola, ¿tienen disponible?" };

export function ConexionWhatsappVisual({
  frame,
  fps,
  tema,
  cuadroCambia,
  textos = {},
}: {
  frame: number;
  fps: number;
  tema: TemaGuion;
  cuadroCambia: number;
  textos?: { icono?: string; etiqueta?: string; texto_problema?: string; mensaje?: string };
}) {
  const t = { ...TEXTOS_CONEXION_POR_DEFECTO, ...Object.fromEntries(Object.entries(textos).filter(([, v]) => !!v)) };
  const conectado = frame >= cuadroCambia;
  const progresoMensaje = spring({ frame: frame - cuadroCambia, fps, config: { damping: 14 } });
  const progresoViaje = interpolarSeguro(frame, [cuadroCambia, cuadroCambia + Math.round(fps * 0.35)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const escalaRespiracion = respiracion(frame, fps);
  const color = conectado ? COLOR_EXITO : COLOR_ALERTA;

  return (
    <AbsoluteFill style={{ top: `${TARJETA_TOP_PORCENTAJE}%`, height: `${TARJETA_ALTURA_PORCENTAJE}%`, transform: `scale(${escalaRespiracion})` }}>
      {/* Anuncio, arriba de este cajón (0%-40% de SU alto, no de toda
          la pantalla). */}
      <div
        style={{
          position: "absolute",
          top: "0%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "68%",
          height: "40%",
          borderRadius: 24,
          background: `linear-gradient(145deg, ${tema.color_primario}, ${tema.color_secundario})`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconoCatalogo valor={t.icono ?? "megafono"} tamano={72} tema={tema} variante="sobre_marca" />
        <span style={{ position: "absolute", top: 10, left: 14, background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 18, fontWeight: 700, padding: "5px 14px", borderRadius: 999 }}>{t.etiqueta}</span>
      </div>

      {/* Línea: cortada (✗) o conectada (mensaje viajando). */}
      {!conectado ? (
        <>
          <div style={{ position: "absolute", top: "41%", left: "50%", transform: "translateX(-50%)", width: 12, height: "6%", background: color, borderRadius: 8 }} />
          <div
            style={{
              position: "absolute",
              top: "47%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: color,
              color: "#fff",
              fontSize: 36,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 26px rgba(0,0,0,0.4)",
            }}
          >
            <IconoCruz tamano={34} color="#fff" />
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", top: "41%", left: "50%", transform: "translateX(-50%)", width: 12, height: "18%", background: color, borderRadius: 8 }} />
          <div
            style={{
              position: "absolute",
              top: `${interpolate(progresoViaje, [0, 1], [41, 59])}%`,
              left: "50%",
              transform: "translateX(-50%)",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#fff",
              opacity: interpolate(progresoViaje, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            }}
          />
        </>
      )}

      {/* Celular, abajo (60%-100% de este cajón). */}
      <div
        style={{
          position: "absolute",
          top: "60%",
          left: "50%",
          width: "80%",
          height: "40%",
          transform: "translateX(-50%)",
          background: "#0a0a0a",
          borderRadius: 30,
          padding: "8px 8px 0 8px",
          boxShadow: conectado ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: "22px 22px 0 0", overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          {conectado ? (
            <div
              style={{
                background: "#f0f0f0",
                color: "#111",
                borderRadius: "20px 20px 20px 5px",
                padding: "18px 24px",
                fontSize: 32,
                fontWeight: 700,
                opacity: progresoMensaje,
                transform: `translateY(${interpolate(progresoMensaje, [0, 1], [16, 0])}px)`,
              }}
            >
              {t.mensaje}
            </div>
          ) : (
            <span style={{ fontSize: 38, fontWeight: 800, color: COLOR_ALERTA, textAlign: "center" }}>{t.texto_problema}</span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
