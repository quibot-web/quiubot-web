// Promovido tal cual desde video/fixtures/organico/referencia/visuales/
// molde.tsx (Fase A, aprobado) -- solo BotonEstado, lo único que este
// VisualSchema necesita de ese archivo (TEMA_QUIUBOT/Titular/
// EsquinaMarca son del molde del reel de referencia, no de la
// biblioteca real todavía).
import { fitText } from "@remotion/layout-utils";
import { colorTextoSobre, type TemaGuion } from "../tema";
import { ANCHO_BOTON_PORCENTAJE_NUM, TAMANO_FUENTE_BOTON, familiaDeFuenteSinCargar } from "./tamanos";

// Fórmula exacta copiada del molde aprobado (molde.tsx) -- no un
// porcentaje redondeado a mano: 88% de la zona segura (ANCHO_MAX_PX
// real de Cta.tsx) * 80% del ancho real del botón dentro de eso.
const ANCHO_BOTON_PORCENTAJE = `${ANCHO_BOTON_PORCENTAJE_NUM.toFixed(1)}%`;
const ANCHO_BOTON_PX = (ANCHO_BOTON_PORCENTAJE_NUM / 100) * 1080;
const PADDING_HORIZONTAL_BOTON_PX = 28;

// Ronda J (revisión de staging real, 18 nov 2026): "Siguiendo
// @quiubot ✓" (el @usuario real, más largo que cualquier texto de
// prueba usado antes) partió en 2 líneas en el mp4 real renderizado
// con @remotion/web-renderer -- aunque una medición con Playwright
// decía que cabía. En vez de confiar en que el texto SIEMPRE quepa a
// TAMANO_FUENTE_BOTON (una apuesta, como ya le pasó a Cta.tsx con
// textos largos -- ver su propio calcularFuenteBoton()), acá se mide
// el ancho real con @remotion/layout-utils (el mismo Chromium real
// que usa cualquier renderer de Remotion, nunca el DOM de una pestaña
// aparte) y se encoge la letra solo si hace falta -- nunca por encima
// de TAMANO_FUENTE_BOTON, y whiteSpace:nowrap para que nunca pueda
// envolver a una 2da línea aunque la medición se equivoque por algo.
function calcularFuenteBotonQueCabe(texto: string, familia: string): number {
  const anchoDisponible = ANCHO_BOTON_PX - PADDING_HORIZONTAL_BOTON_PX * 2;
  const { fontSize } = fitText({ text: texto, withinWidth: anchoDisponible, fontFamily: familia, fontWeight: 800 });
  return Math.min(TAMANO_FUENTE_BOTON, Math.floor(fontSize));
}

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
  // alignItems!=="stretch" -- el mismo caso límite de CSS que ya rompió
  // "Siguiendo ✓" una vez (video/escenas/Cta.tsx) vuelve a romperlo si
  // el ancho real queda un nivel más adentro que el hijo directo del
  // contenedor centrado.
  escalaExtra?: number;
  // El cursor que "hace clic" se ancla por position:relative al MISMO
  // contenedor que el botón -- si se pone como hermano afuera de
  // BotonEstado, en vez de adentro vía children, se ancla al
  // AbsoluteFill (la próxima caja posicionada hacia arriba) y pierde
  // la esquina real del botón.
  children?: React.ReactNode;
}) {
  // Bug real encontrado comparando cuadro a cuadro con la referencia
  // (16 nov 2026): el botón inactivo usaba colorTextoSobre(primario)
  // como SU PROPIO fondo -- pensado para la época en que flotaba
  // directo sobre el degradado de marca (ahí ese cálculo daba blanco,
  // que SÍ se notaba contra el morado). Ahora vive dentro de
  // TarjetaSimple (fondo blanco, video/visuales/index.tsx) -- un botón
  // blanco sobre una tarjeta blanca queda invisible. El color de marca
  // real como fondo (en vez de "lo que contrastaría con" el color de
  // marca) es correcto en cualquier backdrop, y de paso se ve como un
  // botón de marca real, no uno genérico blanco/negro.
  const colorBoton = activo ? colorActivo : tema.color_primario;
  const colorTexto = activo ? "#fff" : colorTextoSobre(colorBoton);
  const fontSize = calcularFuenteBotonQueCabe(texto, familiaDeFuenteSinCargar(tema.fuente));
  return (
    <div style={{ position: "relative", width: ANCHO_BOTON_PORCENTAJE }}>
      <div
        style={{
          width: "100%",
          background: colorBoton,
          color: colorTexto,
          borderRadius: 999,
          padding: `26px ${PADDING_HORIZONTAL_BOTON_PX}px`,
          fontSize,
          fontWeight: 800,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
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
