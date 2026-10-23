// UTM de PRIMER contacto, guardados en sessionStorage al aterrizar en
// /bienvenida -- para saber después qué campaña trajo a un cliente que
// paga. sessionStorage (no una cookie ni localStorage) porque así lo
// aprobó el negocio: vive mientras dure la pestaña, sobrevive la ida y
// vuelta del login con Google (mismo origen, misma pestaña), y nunca
// se sobreescribe con una visita repetida durante esa misma sesión.
const CLAVE_UTM = "qb_utm";

export type UtmPrimerContacto = {
  utm_source?: string;
  utm_campaign?: string;
  utm_content?: string;
};

export function guardarUtmPrimerContacto(url: string): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(CLAVE_UTM)) return; // ya hay uno guardado esta sesión -- primer contacto gana
    const params = new URL(url).searchParams;
    const utm: UtmPrimerContacto = {
      utm_source: params.get("utm_source") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
      utm_content: params.get("utm_content") || undefined,
    };
    if (!utm.utm_source && !utm.utm_campaign && !utm.utm_content) return;
    sessionStorage.setItem(CLAVE_UTM, JSON.stringify(utm));
  } catch {
    // sessionStorage puede fallar (modo privado, storage lleno) -- no es
    // crítico, simplemente no se guarda atribución esta vez.
  }
}

export function leerUtmPrimerContacto(): UtmPrimerContacto | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = sessionStorage.getItem(CLAVE_UTM);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}
