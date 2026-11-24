// Reglas de plan para Contenido, puras (sin sesión ni Next.js): las usan
// las rutas de /contenido (accesoContenido.ts) y el publicador del cron
// (publicadorOrganico.ts), así las dos aplican exactamente lo mismo.

export type UsuarioAcceso = {
  id: string;
  rol: string | null;
  plan: string | null;
  activo: boolean | null;
  en_trial: boolean | null;
  trial_termina_en: string | null;
  fecha_vencimiento: string | null;
};

// Planes que incluyen Contenido (decisión 23 nov 2026). La prueba gratis
// hoy es plan "escala" (medido en la base), así que entra mientras dure.
// Arranque ve la página y sus piezas, pero no crea, genera ni publica.
export const PLANES_CON_CONTENIDO = ["crecimiento", "escala"] as const;
export const MENSAJE_PLAN_SIN_CONTENIDO = "Contenido está incluido en los planes Crecimiento y Escala. Sube de plan para crear y publicar tus reels.";

export const MENSAJE_SUSCRIPCION_INACTIVA = "Tu plan no está activo. Renueva tu suscripción para seguir creando y publicando contenido.";

export function esAdmin(usuario: { rol?: string | null }): boolean {
  return usuario.rol === "admin";
}

// ¿Está al día? Mismo criterio de vigencia que tieneAutopiloto
// (planesConfig.ts): prueba gratis sin vencer, o pago con fecha_vencimiento
// futura. Qué planes incluyen Contenido lo decide puedeCrearContenido.
export function suscripcionActiva(usuario: Pick<UsuarioAcceso, "rol" | "activo" | "en_trial" | "trial_termina_en" | "fecha_vencimiento">, ahora = new Date()): boolean {
  if (esAdmin(usuario)) return true;
  if (usuario.en_trial && usuario.trial_termina_en && new Date(usuario.trial_termina_en) >= ahora) return true;
  return usuario.activo === true && !!usuario.fecha_vencimiento && new Date(usuario.fecha_vencimiento) >= ahora;
}

// ¿Puede crear, generar, renderizar y publicar? Admin siempre; si no, un
// plan con Contenido y vigente (pago al día o prueba gratis sin vencer).
export function puedeCrearContenido(usuario: Pick<UsuarioAcceso, "rol" | "plan" | "activo" | "en_trial" | "trial_termina_en" | "fecha_vencimiento">, ahora = new Date()): boolean {
  if (esAdmin(usuario)) return true;
  return (PLANES_CON_CONTENIDO as readonly string[]).includes(usuario.plan ?? "") && suscripcionActiva(usuario, ahora);
}

// Por qué no puede crear: plan sin Contenido (subir de plan) o plan con
// Contenido pero vencido (renovar).
export function motivoSinContenido(usuario: Pick<UsuarioAcceso, "plan">): { codigo: "plan_sin_contenido" | "suscripcion_inactiva"; mensaje: string } {
  return (PLANES_CON_CONTENIDO as readonly string[]).includes(usuario.plan ?? "")
    ? { codigo: "suscripcion_inactiva", mensaje: MENSAJE_SUSCRIPCION_INACTIVA }
    : { codigo: "plan_sin_contenido", mensaje: MENSAJE_PLAN_SIN_CONTENIDO };
}
