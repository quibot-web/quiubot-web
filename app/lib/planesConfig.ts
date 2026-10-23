export type PlanId = "arranque" | "crecimiento" | "escala";

export const PLANES: Record<
  PlanId,
  {
    nombre: string;
    estrategiasPorMes: number | null;
    campanasVigiladas: number | null;
    creativosJobsPorMes: number | null;
    videosPorMes: number | null;
    precio: number;
  }
> = {
  arranque: { nombre: "Arranque", estrategiasPorMes: 1, campanasVigiladas: 0, creativosJobsPorMes: 5, videosPorMes: 0, precio: 0 },
  crecimiento: { nombre: "Crecimiento", estrategiasPorMes: 4, campanasVigiladas: 2, creativosJobsPorMes: 20, videosPorMes: 5, precio: 149900 },
  escala: { nombre: "Escala", estrategiasPorMes: null, campanasVigiladas: null, creativosJobsPorMes: null, videosPorMes: 15, precio: 249900 },
};

// Orden de jerarquía, para comparar "¿mi plan alcanza para esto?"
const ORDEN_PLANES: PlanId[] = ["arranque", "crecimiento", "escala"];

export function planAlcanzaPara(planUsuario: PlanId, planMinimo: PlanId): boolean {
  return ORDEN_PLANES.indexOf(planUsuario) >= ORDEN_PLANES.indexOf(planMinimo);
}

// Interruptor único del lanzamiento del Autopiloto. El id "escala" no
// cambia en ningún lado (base, código, órdenes de Bold) -- esto solo
// controla el nombre comercial que ve el cliente y a quién se le abre
// la función. Apagado: todo se ve y se comporta exactamente como hoy.
export const AUTOPILOTO_PUBLICO = false;

// Nombre que ve el cliente para un plan -- el único lugar que decide
// si el plan "escala" se llama "Autopiloto". Todo lo que el cliente lee
// (página de planes, el Director, correos, mensajes de error de plan
// insuficiente) debe pasar por aquí en vez de leer PLANES[id].nombre
// directamente, para que encender o apagar AUTOPILOTO_PUBLICO cambie
// el nombre en todos esos lugares a la vez.
export function nombreVisiblePlan(id: PlanId): string {
  if (id === "escala" && AUTOPILOTO_PUBLICO) return "Autopiloto";
  return PLANES[id].nombre;
}

// Beneficios propios del Autopiloto, encima de los que ya tiene Escala
// -- solo se agregan con el interruptor encendido. Compartido entre
// /billing y /bienvenida para que digan exactamente lo mismo.
export const BENEFICIOS_AUTOPILOTO: string[] = [
  "Un equipo de 7 asistentes trabajando por tu meta todos los días",
  "Define tu meta (conversaciones o leads) y sigue su avance en tiempo real",
  "El Director te propone cada mejora y tú decides: nada cambia sin tu aprobación",
  "Refresco de creativos y ajustes de presupuesto cuando hacen falta",
];

// Quién tiene acceso al Autopiloto (meta, equipo, conversación con el
// Director, recordatorio de renovación): admin siempre, beta por
// cliente siempre (columna beta_autopiloto, la activa un humano por
// SQL), y si no, solo cuando el interruptor está encendido Y el plan
// es "escala" Y el pago está vigente (pagado con fecha_vencimiento
// futura, o en_trial -- la prueba gratis de 14 días todavía no existe,
// pero en_trial ya es un campo real en usuarios).
export function tieneAutopiloto(usuario: {
  rol?: string | null;
  beta_autopiloto?: boolean | null;
  plan?: string | null;
  en_trial?: boolean | null;
  fecha_vencimiento?: string | null;
}): boolean {
  if (usuario.rol === "admin") return true;
  if (usuario.beta_autopiloto) return true;
  if (!AUTOPILOTO_PUBLICO) return false;
  if (usuario.plan !== "escala") return false;
  if (usuario.en_trial) return true;
  return !!usuario.fecha_vencimiento && new Date(usuario.fecha_vencimiento) >= new Date();
}