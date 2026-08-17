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