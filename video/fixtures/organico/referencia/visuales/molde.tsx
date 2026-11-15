// "Molde" compartido entre los reels de referencia (pedido explícito
// del usuario: "este será el molde para el Reel 2 y la biblioteca") --
// el tema de marca, el titular animado y la insignia de esquina se
// comportan IGUAL en cualquier reel que seguramente seguirá leyendo lo
// que diseñamos acá, así que viven en un solo lugar en vez de copiarse
// por reel.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colorTextoSobre, type TemaGuion } from "../../../../tema";
import { TITULAR_TOP_PORCENTAJE } from "./geometria";

// Sin el ícono real de marca (spinner de carga en este formato, ver
// video/fixtures/organico/referencia/ReelConsejosNumerados.tsx para el
// hallazgo completo): logo_url queda null a propósito, todo lo que
// antes mostraba el Img cae a su respaldo de texto "Quiubot"/"Q".
export const TEMA_QUIUBOT: TemaGuion = {
  color_primario: "#534AB7",
  color_secundario: "#7F77DD",
  fuente: "moderna",
  logo_url: null,
  nombre_marca: "Quiubot",
};

// Reemplaza a capas/Logo.tsx (que solo sabe mostrar un Img) -- acá
// siempre es texto, nunca el ícono real. Arriba del todo (4%), NO a
// 16% como capas/Bucle.tsx/CapaLogo reales -- ahí chocaba con el
// titular de cada escena, que también empieza cerca del borde superior
// de la zona segura.
export function EsquinaMarca({ tema }: { tema: TemaGuion }) {
  const colorTexto = colorTextoSobre(tema.color_primario);
  return (
    <div
      style={{
        position: "absolute",
        top: "4%",
        right: "6%",
        background: "rgba(0,0,0,0.22)",
        borderRadius: 999,
        padding: "8px 20px",
      }}
    >
      <span style={{ fontSize: 26, fontWeight: 900, color: colorTexto }}>Quiubot</span>
    </div>
  );
}

export function Titular({ texto, colorTexto }: { texto: string; colorTexto: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progreso = spring({ frame, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        top: `${TITULAR_TOP_PORCENTAJE}%`,
        left: "50%",
        transform: `translateX(-50%) translateY(${interpolate(progreso, [0, 1], [16, 0])}px)`,
        width: "84%",
        textAlign: "center",
        fontSize: 64,
        fontWeight: 800,
        color: colorTexto,
        lineHeight: 1.1,
        opacity: progreso,
      }}
    >
      {texto}
    </div>
  );
}

const ANCHO_BOTON_PORCENTAJE = `${(((1080 * 0.88 * 0.8) / 1080) * 100).toFixed(1)}%`;

// Botón de CTA con cambio de estado al hacer clic (pedido explícito:
// "CTA corto con cambio de estado") -- el mismo contenedor con ancho
// real (no display:inline-block, ver el hallazgo real documentado en
// video/escenas/Cta.tsx) para que el texto nunca se parta a mitad de
// palabra sin importar qué tan largo sea.
export function BotonEstado({
  texto,
  tema,
  progreso,
  activo,
  colorActivo,
  escalaExtra = 1,
  children,
}: {
  texto: string;
  tema: TemaGuion;
  progreso: number;
  activo?: boolean;
  colorActivo: string;
  // Para un "pop" extra (ej. al cambiar de estado) -- se multiplica
  // sobre el mismo div que ya tiene el ancho real. NUNCA envolver este
  // componente en un div extra solo para animarlo: ese div, al no tener
  // ancho propio, es un hijo "shrink-to-fit" de un flex con
  // alignItems!=="stretch" (como el AbsoluteFill centrado del CTA) -- el
  // mismo caso límite de CSS que ya rompió "Siguiendo ✓" una vez
  // (video/escenas/Cta.tsx) vuelve a romperlo si el ancho real queda un
  // nivel más adentro que el hijo directo del contenedor centrado.
  escalaExtra?: number;
  // El cursor que "hace clic" (CursorClicGenerico) se ancla por
  // position:relative al MISMO contenedor que el botón -- si se pone
  // como hermano afuera de BotonEstado, en vez de adentro vía children,
  // se ancla al AbsoluteFill (la próxima caja posicionada hacia arriba)
  // y pierde la esquina real del botón.
  children?: React.ReactNode;
}) {
  const colorBoton = activo ? colorActivo : colorTextoSobre(tema.color_primario);
  const colorTexto = activo ? "#fff" : colorTextoSobre(colorBoton);
  return (
    <div style={{ position: "relative", width: ANCHO_BOTON_PORCENTAJE }}>
      <div
        style={{
          width: "100%",
          background: colorBoton,
          color: colorTexto,
          borderRadius: 999,
          padding: "26px 28px",
          fontSize: 52,
          fontWeight: 800,
          textAlign: "center",
          whiteSpace: "normal",
          wordBreak: "break-word",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          transform: `scale(${progreso * escalaExtra})`,
        }}
      >
        {texto}
      </div>
      {children}
    </div>
  );
}
