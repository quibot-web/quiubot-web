// Promovido tal cual desde video/fixtures/organico/referencia/visuales/
// molde.tsx (Fase A, aprobado) -- solo BotonEstado, lo único que este
// VisualSchema necesita de ese archivo (TEMA_QUIUBOT/Titular/
// EsquinaMarca son del molde del reel de referencia, no de la
// biblioteca real todavía).
import { colorTextoSobre, type TemaGuion } from "../tema";
import { ANCHO_BOTON_PORCENTAJE_NUM, TAMANO_FUENTE_BOTON } from "./tamanos";

// Fórmula exacta copiada del molde aprobado (molde.tsx) -- no un
// porcentaje redondeado a mano: 88% de la zona segura (ANCHO_MAX_PX
// real de Cta.tsx) * 80% del ancho real del botón dentro de eso.
const ANCHO_BOTON_PORCENTAJE = `${ANCHO_BOTON_PORCENTAJE_NUM.toFixed(1)}%`;

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
  return (
    <div style={{ position: "relative", width: ANCHO_BOTON_PORCENTAJE }}>
      <div
        style={{
          width: "100%",
          background: colorBoton,
          color: colorTexto,
          borderRadius: 999,
          padding: "26px 28px",
          fontSize: TAMANO_FUENTE_BOTON,
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
