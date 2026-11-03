import { GuionSchema } from "../guion.schema";

// Ejemplo que respeta la receta compartida de
// video/recetas/traficoYVisitasWeb.ts (trafico_mensajes y visitas_web).
export const fixtureTraficoMensajes = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "trafico_mensajes",
  duracion_objetivo_s: 9,
  bucle: { texto: "La 3ª está en la web", abre_en: "e1", cierra_en: "e3", indicador: "espera_final" },
  tema: {
    color_primario: "#6A1B9A",
    color_secundario: "#CE93D8",
    color_fondo: "#0D0A22",
    color_texto: "#FFFFFF",
    fuente: "moderna",
    logo_url: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2,
      subtitulo: { texto: "3 errores que arruinan tu jardín", palabra_clave: "errores" },
      params: { texto: "3 errores que arruinan tu jardín", palabra_clave: "errores" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      subtitulo: { texto: "Regar de más, poca luz, y el tercero te sorprende", palabra_clave: "sorprende" },
      params: { titulo: "3 errores comunes", items: ["Regar de más", "Poca luz solar", "El tercero, en la web"] },
    },
    {
      id: "e3",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      subtitulo: { texto: "Mira todo aquí", palabra_clave: "Mira" },
      params: { accion: "web", texto_boton: "Mira todo aquí" },
    },
  ],
});
