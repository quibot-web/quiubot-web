// Reel ilustrado activo solo para las cuentas de la lista (fase 2-3 del
// plan aprobado: para el lanzamiento del 30 nov 2026 solo la cuenta de
// Juan José; los clientes siguen con Noche / Color pleno / Foto).
// REELS_ILUSTRADOS_EMAILS="a@b.com, c@d.com" -- sin variable, nadie.
export function reelIlustradoActivo(email: string | null | undefined, lista = process.env.REELS_ILUSTRADOS_EMAILS): boolean {
  if (!email || !lista) return false;
  const correos = lista.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  return correos.includes(email.trim().toLowerCase());
}
