// Promovido tal cual desde video/fixtures/organico/referencia/visuales/
// molde.tsx (Fase A, aprobado) -- solo BotonEstado, lo único que este
// VisualSchema necesita de ese archivo (TEMA_QUIUBOT/Titular/
// EsquinaMarca son del molde del reel de referencia, no de la
// biblioteca real todavía).
import { interpolate } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { colorTextoSobre, type TemaGuion } from "../tema";
import { ANCHO_BOTON_PORCENTAJE_NUM, TAMANO_FUENTE_BOTON, familiaDeFuenteSinCargar } from "./tamanos";
import { TARJETA_ANCHO_PORCENTAJE } from "./geometria";

// Fórmula exacta copiada del molde aprobado (molde.tsx) -- no un
// porcentaje redondeado a mano: 88% de la zona segura (ANCHO_MAX_PX
// real de Cta.tsx) * 80% del ancho real del botón dentro de eso.
const ANCHO_BOTON_PORCENTAJE = `${ANCHO_BOTON_PORCENTAJE_NUM.toFixed(1)}%`;
const PADDING_HORIZONTAL_BOTON_PX = 28;

// Ronda K (revisión real en staging, 19 nov 2026): "Siguiendo @quiubot
// ✓" seguía recortándose en el mp4 real aunque fitText() ya medía el
// texto -- el error real no era la medición, era la BASE: este
// componente SIEMPRE vive dentro de TarjetaSimple.tsx (video/visuales/
// index.tsx, casos "boton_estado"/"cursor_clic", el único lugar que lo
// usa en todo el proyecto), que ocupa TARJETA_ANCHO_PORCENTAJE (80%)
// del cuadro de 1080px -- no el cuadro completo. ANCHO_BOTON_PX
// calculaba el ancho real del botón como 70.4% de 1080 (760px) cuando
// el ancho real disponible es 70.4% de (1080*0.80)=864px (608px) --
// casi 150px de diferencia, suficiente para que un texto corto
// ("Seguir") nunca lo notara pero uno largo con el @usuario real sí.
// fitText() medía bien, solo que contra un presupuesto de ancho que no
// era el real.
const ANCHO_BOTON_PX = (ANCHO_BOTON_PORCENTAJE_NUM / 100) * (TARJETA_ANCHO_PORCENTAJE / 100) * 1080;

// Margen chico de respaldo (no la causa principal, ya corregida arriba):
// un carácter como "✓" puede no tener glifo en la fuente de marca y
// pintarse con una fuente de respaldo del sistema que fitText() no
// puede medir -- esto absorbe esa diferencia menor sin volver a
// adivinar el ancho base completo.
const MARGEN_SEGURIDAD_GLIFO_PX = 16;

function calcularFuenteBotonQueCabe(texto: string, familia: string): number {
  const anchoDisponible = ANCHO_BOTON_PX - PADDING_HORIZONTAL_BOTON_PX * 2 - MARGEN_SEGURIDAD_GLIFO_PX;
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
  // Ronda K: el estado activo usaba "#fff" fijo en vez de calcularlo --
  // blanco sobre el verde real de colorActivo no pasa
  // contrasteSuficiente(). colorTextoSobre() ya es la fórmula
  // establecida y probada del proyecto para esto (igual que el estado
  // inactivo, justo arriba) -- los dos estados ahora la usan igual,
  // sin excepción.
  const colorBoton = activo ? colorActivo : tema.color_primario;
  const colorTexto = colorTextoSobre(colorBoton);
  const fontSize = calcularFuenteBotonQueCabe(texto, familiaDeFuenteSinCargar(tema.fuente));
  // Ronda L (revisión real en staging): "progreso*escalaExtra" arranca
  // en escala 0 -- el botón es invisible/imperceptible durante toda la
  // rampa del spring (~0.5s), aunque su evento "aparece" ya dispare en
  // la palabra 0 de la escena. Remapeado a [0.9,1] (mismo criterio que
  // AnuncioBotonVisual.tsx's entrada): visible desde el primer cuadro,
  // el spring solo entrega el último 10% del "pop".
  const escalaEntrada = interpolate(progreso, [0, 1], [0.9, 1]);
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
          transform: `scale(${escalaEntrada * escalaExtra})`,
        }}
      >
        {texto}
      </div>
      {children}
    </div>
  );
}
