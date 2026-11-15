// Visual "medidor de presupuesto": barra que se llena al máximo (mito
// -- "entre más gastas, más mensajes") y después baja a un nivel
// moderado mientras el indicador de mensajes sí sube (verdad). Mismo
// componente se reusa en el gancho (solo la mitad "mito") y en el
// cierre del bucle (solo la mitad "verdad") -- pedido explícito: "el
// bucle que se cierra en el mismo lugar donde se abrió".
import { interpolate, spring } from "remotion";
import { respiracion, type TemaGuion } from "../../../../tema";
import { COLOR_ALERTA, COLOR_EXITO } from "./acento";
import { TARJETA_ANCHO_PORCENTAJE, TARJETA_TOP_PORCENTAJE } from "./geometria";

export interface MedidorPresupuestoProps {
  frame: number;
  fps: number;
  tema: TemaGuion;
  // Si no se pasa cuadroCorte, el medidor se queda fijo en el estado
  // "mito" (gancho) o "verdad" (cierre del bucle) todo el tiempo --
  // nunca hace la transición completa de una tarjeta a otra.
  cuadroCorte?: number;
  // Cuando no hay transición, cuál mitad mostrar.
  estadoFijo?: "mito" | "verdad";
  escalaCamara?: number;
}

const NIVEL_MAXIMO = 92;
const NIVEL_OPTIMO = 46;
const MENSAJES_MITO = 1;
const MENSAJES_VERDAD = 6;

export function MedidorPresupuesto({ frame, fps, tema, cuadroCorte, estadoFijo, escalaCamara = 1 }: MedidorPresupuestoProps) {
  const esVerdad = cuadroCorte !== undefined ? frame >= cuadroCorte : estadoFijo === "verdad";
  const progreso = cuadroCorte !== undefined ? spring({ frame: frame - cuadroCorte, fps, config: { damping: 14 } }) : 1;
  const color = esVerdad ? COLOR_EXITO : COLOR_ALERTA;
  const nivel = esVerdad ? interpolate(progreso, [0, 1], [NIVEL_MAXIMO, NIVEL_OPTIMO]) : NIVEL_MAXIMO;
  const mensajes = esVerdad ? Math.round(interpolate(progreso, [0, 1], [MENSAJES_MITO, MENSAJES_VERDAD])) : MENSAJES_MITO;
  const escalaRespiracion = respiracion(frame, fps);

  return (
    <div
      style={{
        position: "absolute",
        top: `${TARJETA_TOP_PORCENTAJE}%`,
        left: "50%",
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        // Alto automático, no el porcentaje fijo de la zona segura: con
        // solo 3 filas de contenido, forzar el 40% de alto dejaba un
        // hueco blanco enorme arriba y abajo (pedido explícito: "si no
        // hay contenido para llenar la tarjeta, la tarjeta se achica").
        height: "auto",
        transform: `translateX(-50%) scale(${escalaCamara * escalaRespiracion})`,
        background: "#fff",
        borderRadius: 32,
        boxShadow: esVerdad ? `0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px ${COLOR_EXITO}55` : "0 30px 80px rgba(0,0,0,0.5)",
        padding: "48px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 700, color: "#333" }}>📣 Presupuesto del anuncio</div>
      <div style={{ width: "100%", height: 84, borderRadius: 42, background: "#eee", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${nivel}%`, background: color, borderRadius: 42 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: "#666" }}>💬 mensajes</span>
        <span style={{ fontSize: 96, fontWeight: 900, color, lineHeight: 1 }}>{mensajes}</span>
      </div>
    </div>
  );
}
