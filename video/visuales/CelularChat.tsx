// Promovido tal cual desde video/fixtures/organico/referencia/visuales/
// CelularChat.tsx (Fase A, aprobado) -- geometría compartida (80% de
// ancho, llena la zona segura) y tipografía grande (mensajes a 44px).
import { AbsoluteFill, Img, interpolate, spring } from "remotion";
import { respiracion, type TemaGuion } from "../tema";
import { ContadorBadge } from "./Contador";
import { TARJETA_ALTURA_PORCENTAJE, TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";
import { TAMANO_FUENTE_MENSAJE, TAMANO_FUENTE_NOTIFICACION, TAMANO_FUENTE_NUMERO_GIGANTE, TAMANO_FUENTE_ETIQUETA_NUMERO_GIGANTE } from "./tamanos";
import { IconoBurbuja } from "../iconos";
import { useSuperficie } from "../estilos/superficie";

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
  // "Nada se queda quieto": el "0 mensajes nuevos" del gancho parpadea
  // en vez de quedar estático toda la escena.
  parpadear?: boolean;
  mensajes?: MensajeChat[];
  // Cuadros de llegada de notificaciones genéricas -- distinto de
  // `mensajes`: son avisos de sistema, no una conversación real, así
  // que se ven como franjas de notificación, no como burbujas de chat.
  notificaciones?: number[];
  mostrarContadorNuevos?: boolean;
  textoVacio?: string;
  // "0" gigante (color de alerta), o el número subiendo 0->N (color de
  // éxito). Cuando también hay `notificaciones`, esas entran chicas
  // arriba, detrás del número.
  colorNumeroGigante?: string;
  // Escala de "cámara" (acercamiento): 1 = normal.
  escalaCamara?: number;
}

function Tarjeta({ children, escalaCamara = 1 }: { children: React.ReactNode; escalaCamara?: number }) {
  const s = useSuperficie();
  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: `${TARJETA_ALTURA_PORCENTAJE}%`,
        transform: `translateX(-50%) scale(${escalaCamara})`,
        background: s.marco,
        border: s.borde ? `5px solid ${s.borde}` : undefined,
        borderRadius: 36,
        padding: "10px 10px 0 10px",
        boxShadow: s.sombra,
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: "26px 26px 0 0", overflow: "hidden", background: s.tarjeta, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

function Encabezado({ tema, nuevos, mostrarContadorNuevos }: { tema: TemaGuion; nuevos: number; mostrarContadorNuevos?: boolean }) {
  const s = useSuperficie();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "26px 30px", flexShrink: 0, borderBottom: `2px solid ${s.separador}` }}>
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
      <div style={{ fontSize: 30, fontWeight: 800, color: s.texto, flexGrow: 1 }}>{tema.nombre_marca || "Nuestro negocio"}</div>
      {mostrarContadorNuevos && <ContadorBadge valor={nuevos} color={COLOR_WHATSAPP} colorTexto="#fff" tamano={54} />}
    </div>
  );
}

function BurbujaMensaje({ mensaje, frame, fps }: { mensaje: MensajeChat; frame: number; fps: number }) {
  const s = useSuperficie();
  const progreso = spring({ frame: frame - mensaje.cuadroLlegada, fps, config: { damping: 14 } });
  if (frame < mensaje.cuadroLlegada - 5) return null;
  return (
    <div
      style={{
        alignSelf: mensaje.propio ? "flex-end" : "flex-start",
        background: mensaje.propio ? COLOR_WHATSAPP : s.burbuja,
        color: mensaje.propio ? "#fff" : s.textoBurbuja,
        borderRadius: mensaje.propio ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
        padding: "20px 26px",
        fontSize: TAMANO_FUENTE_MENSAJE,
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
// competirle el espacio.
function FranjaNotificacion({ cuadroLlegada, frame, fps, compacta }: { cuadroLlegada: number; frame: number; fps: number; compacta?: boolean }) {
  const s = useSuperficie();
  const progreso = spring({ frame: frame - cuadroLlegada, fps, config: { damping: 16 } });
  // Antes de llegar, la franja ya ocupa su lugar (invisible): si no, el
  // número gigante de abajo se corría con cada notificación nueva.
  const reservada = frame < cuadroLlegada - 5;
  return (
    <div
      style={{
        visibility: reservada ? "hidden" : undefined,
        display: "flex",
        alignItems: "center",
        gap: compacta ? 12 : 16,
        background: s.burbuja,
        borderRadius: compacta ? 14 : 18,
        padding: compacta ? "10px 16px" : "18px 24px",
        opacity: progreso,
        transform: `translateY(${interpolate(progreso, [0, 1], [-20, 0])}px)`,
      }}
    >
      <IconoBurbuja tamano={compacta ? 26 : 42} color={COLOR_WHATSAPP} />
      <span style={{ fontSize: compacta ? 22 : TAMANO_FUENTE_NOTIFICACION, fontWeight: 700, color: s.textoBurbuja }}>Nuevo mensaje de un cliente</span>
    </div>
  );
}

function NumeroGigante({ valor, color, opacidad }: { valor: number; color: string; opacidad: number }) {
  const s = useSuperficie();
  return (
    <div data-estable="celular-numero" style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, opacity: opacidad }}>
      <span style={{ fontSize: TAMANO_FUENTE_NUMERO_GIGANTE, fontWeight: 900, color, lineHeight: 1 }}>{valor}</span>
      <span style={{ fontSize: TAMANO_FUENTE_ETIQUETA_NUMERO_GIGANTE, fontWeight: 800, color: s.textoSuave }}>mensajes nuevos</span>
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
  const superficie = useSuperficie();
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
            <IconoBurbuja tamano={90} color="#9a9a9a" />
            <span style={{ fontSize: 40, fontWeight: 800, color: superficie.textoSuave }}>{textoVacio}</span>
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
