// Reel ilustrado activo solo para las cuentas de la lista (fase 2-3 del
// plan aprobado: para el lanzamiento del 30 nov 2026 solo la cuenta de
// Juan José; los clientes siguen con Noche / Color pleno / Foto).
// REELS_ILUSTRADOS_EMAILS="a@b.com, c@d.com" -- sin variable, nadie.
export function reelIlustradoActivo(email: string | null | undefined, lista = process.env.REELS_ILUSTRADOS_EMAILS): boolean {
  if (!email || !lista) return false;
  const correos = lista.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  return correos.includes(email.trim().toLowerCase());
}

// "j***l@gmail.com": para mostrar qué sesión se comparó, sin el correo completo.
export function enmascararCorreo(email: string): string {
  const limpio = email.trim().toLowerCase();
  const [usuario, dominio] = limpio.split("@");
  if (!dominio) return "***";
  return usuario.length <= 2 ? `${usuario[0] ?? ""}***@${dominio}` : `${usuario[0]}***${usuario[usuario.length - 1]}@${dominio}`;
}

// Estado para la página de admin: ¿la variable se está leyendo y esta
// cuenta está en ella? Nunca devuelve la lista ni el correo completo.
export function estadoReelIlustrado(email: string | null | undefined, lista = process.env.REELS_ILUSTRADOS_EMAILS): { activo: boolean; correosEnLaVariable: number; sesion: string | null } {
  const correos = (lista ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  return { activo: reelIlustradoActivo(email, lista), correosEnLaVariable: correos.length, sesion: email ? enmascararCorreo(email) : null };
}
