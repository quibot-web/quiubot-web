// Canal de soporte humano. Una sola constante para no repetir el número
// en billing, pago-exitoso y el asistente flotante.
export const WHATSAPP_SOPORTE = "573243490766";

export function urlWhatsappSoporte(mensaje?: string): string {
  const base = `https://wa.me/${WHATSAPP_SOPORTE}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
