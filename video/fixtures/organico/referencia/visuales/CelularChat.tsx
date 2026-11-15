// Visual "celular con chat". Revisión del usuario (15 nov 2026): el
// celular ocupaba ~25% del ancho y el texto adentro era ilegible a
// tamaño real de teléfono -- ahora usa la geometría compartida
// (geometria.ts: 80% de ancho, llena la zona segura) y tipografía
// bastante más grande (mensajes a 44px, antes 22px).
import { AbsoluteFill, Img, interpolate, spring } from "remotion";
import { respiracion, type TemaGuion } from "../../../../tema";
import { ContadorBadge } from "./Contador";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

const COLOR_WHATSAPP = "#25D366";

export interface MensajeChat {
  texto: string;
  cuadroLlegada: number;
  propio?: boolean; // true = burbuja "enviada" (verde, a la derecha)
}

export interface CelularChatProps {
  frame: number;
  fps: number;
  tema: TemaGuion;
  // Buzón vacío (gancho "0 mensajes nuevos") -- sin mensajes, solo un
  // estado silencioso.
  vacio?: boolean;
  // "Nada se queda quieto" (pedido explícito, v3): el "0 mensajes
  // nuevos" del gancho parpadea en vez de quedar estático toda la escena.
  parpadear?: boolean;
  mensajes?: MensajeChat[];
  // Cuadros de llegada de notificaciones genéricas (pedido explícito,
  // v3, "cerrar el bucle": volver al MISMO celular del gancho, pero
  // ahora con notificaciones entrando una tras otra) -- distinto de
  // `mensajes`: son avisos de sistema, no una conversación real, así
  // que se ven como franjas de notificación, no como burbujas de chat.
  notificaciones?: number[];
  mostrarContadorNuevos?: boolean;
  textoVacio?: string;
  // "0" gigante en el gancho (color de alerta), o el número subiendo
  // 0->N en el cierre del bucle (color de éxito) -- pedido explícito,
  // v4: "que se lea de un vistazo 'de 0 a 3'". Cuando también hay
  // `notificaciones`, esas entran chicas arriba, detrás del número.
  colorNumeroGigante?: string;
  // Escala de "cámara" (acercamiento): 1 = normal. Se anima desde el
  // caller para simular un zoom hacia el celular en momentos clave
  // (pedido explícito: "acercamientos de cámara a la parte que importa").
  escalaCamara?: number;
}

function Tarjeta({ children, escalaCamara = 1 }: { children: React.ReactNode; escalaCamara?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: `translateX(-50%) scale(${escalaCamara})`,
        background: "#0a0a0a",
        borderRadius: 36,
        padding: "10px 10px 0 10px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: "26px 26px 0 0", overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

function Encabezado({ tema, nuevos, mostrarContadorNuevos }: { tema: TemaGuion; nuevos: number; mostrarContadorNuevos?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "26px 30px", flexShrink: 0, borderBottom: "2px solid #eee" }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: tema.logo_url ? "#fff" : tema.color_primario,
          border: tema.logo_url ? "1px solid #eee" : undefined,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {tema.logo_url ? <Img src={tema.logo_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ color: "#fff", fontWeight: 900, fontSize: 24 }}>Q</span>}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#111", flexGrow: 1 }}>{tema.nombre_marca || "Nuestro negocio"}</div>
      {mostrarContadorNuevos && <ContadorBadge valor={nuevos} color={COLOR_WHATSAPP} colorTexto="#fff" tamano={54} />}
    </div>
  );
}

function BurbujaMensaje({ mensaje, frame, fps }: { mensaje: MensajeChat; frame: number; fps: number }) {
  const progreso = spring({ frame: frame - mensaje.cuadroLlegada, fps, config: { damping: 14 } });
  if (frame < mensaje.cuadroLlegada - 5) return null;
  return (
    <div
      style={{
        alignSelf: mensaje.propio ? "flex-end" : "flex-start",
        background: mensaje.propio ? COLOR_WHATSAPP : "#f0f0f0",
        color: mensaje.propio ? "#fff" : "#111",
        borderRadius: mensaje.propio ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
        padding: "20px 26px",
        fontSize: 40,
        fontWeight: 700,
        maxWidth: "88%",
        opacity: progreso,
        transform: `translateY(${interpolate(progreso, [0, 1], [16, 0])}px) scale(${interpolate(progreso, [0, 1], [0.9, 1])})`,
      }}
    >
      {mensaje.texto}
    </div>
  );
}

// `compacta`: cuando entra detrás del número gigante, más chica para no
// competirle el espacio -- el texto suelto (sin número al lado) se
// agrandó por pedido explícito del usuario ("agranda... el texto de
// las notificaciones").
function FranjaNotificacion({ cuadroLlegada, frame, fps, compacta }: { cuadroLlegada: number; frame: number; fps: number; compacta?: boolean }) {
  const progreso = spring({ frame: frame - cuadroLlegada, fps, config: { damping: 16 } });
  if (frame < cuadroLlegada - 5) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compacta ? 12 : 16,
        background: "#f5f5f7",
        borderRadius: compacta ? 14 : 18,
        padding: compacta ? "10px 16px" : "18px 24px",
        opacity: progreso,
        transform: `translateY(${interpolate(progreso, [0, 1], [-20, 0])}px)`,
      }}
    >
      <span style={{ fontSize: compacta ? 26 : 42 }}>💬</span>
      <span style={{ fontSize: compacta ? 22 : 40, fontWeight: 700, color: "#222" }}>Nuevo mensaje de un cliente</span>
    </div>
  );
}

function NumeroGigante({ valor, color, opacidad }: { valor: number; color: string; opacidad: number }) {
  return (
    <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, opacity: opacidad }}>
      <span style={{ fontSize: 260, fontWeight: 900, color, lineHeight: 1 }}>{valor}</span>
      <span style={{ fontSize: 44, fontWeight: 800, color: "#444" }}>mensajes nuevos</span>
    </div>
  );
}

export function CelularChat({
  frame,
  fps,
  tema,
  vacio,
  parpadear,
  mensajes = [],
  notificaciones,
  mostrarContadorNuevos,
  textoVacio = "0 mensajes nuevos",
  colorNumeroGigante,
  escalaCamara = 1,
}: CelularChatProps) {
  const nuevos = notificaciones ? notificaciones.filter((c) => frame >= c).length : mensajes.filter((m) => frame >= m.cuadroLlegada).length;
  const escalaRespiracion = respiracion(frame, fps);
  const opacidadParpadeo = parpadear ? 0.45 + Math.abs(Math.sin((frame / fps / 0.6) * Math.PI)) * 0.55 : 1;

  return (
    <AbsoluteFill style={{ transform: `scale(${escalaRespiracion})` }}>
      <Tarjeta escalaCamara={escalaCamara}>
        <Encabezado tema={tema} nuevos={nuevos} mostrarContadorNuevos={mostrarContadorNuevos} />
        {colorNumeroGigante ? (
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {notificaciones && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "18px 24px 0" }}>
                {notificaciones.map((c, i) => (
                  <FranjaNotificacion key={i} cuadroLlegada={c} frame={frame} fps={fps} compacta />
                ))}
              </div>
            )}
            <NumeroGigante valor={nuevos} color={colorNumeroGigante} opacidad={opacidadParpadeo} />
          </div>
        ) : vacio ? (
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, opacity: 0.55 * opacidadParpadeo }}>
            <span style={{ fontSize: 90 }}>💬</span>
            <span style={{ fontSize: 40, fontWeight: 800, color: "#444" }}>{textoVacio}</span>
          </div>
        ) : notificaciones ? (
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 16, padding: "28px 26px", overflow: "hidden", justifyContent: "flex-start" }}>
            {notificaciones.map((c, i) => (
              <FranjaNotificacion key={i} cuadroLlegada={c} frame={frame} fps={fps} />
            ))}
          </div>
        ) : (
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 20, padding: "28px 26px", overflow: "hidden" }}>
            {mensajes.map((m, i) => (
              <BurbujaMensaje key={i} mensaje={m} frame={frame} fps={fps} />
            ))}
          </div>
        )}
      </Tarjeta>
    </AbsoluteFill>
  );
}
