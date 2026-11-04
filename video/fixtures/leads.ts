import { GuionSchema } from "../guion.schema";

// Ejemplo que respeta la receta de video/recetas/leads.ts.
export const fixtureLeads = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "leads",
  duracion_objetivo_s: 14,
  bucle: { texto: "Te digo cuánto cuesta tu proyecto", abre_en: "e1", cierra_en: "e5", indicador: "espera_final" },
  tema: {
    color_primario: "#42A5F5",
    color_secundario: "#64B5F6",
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
      subtitulo: { texto: "¿No sabes cuánto cuesta tu reforma?", palabra_clave: "cuánto" },
      params: { texto: "¿No sabes cuánto cuesta tu reforma?", palabra_clave: "cuánto" },
    },
    {
      id: "e2",
      bloque: "problema",
      tipo: "problema_dato",
      duracion_s: 2.5,
      subtitulo: { texto: "Pedir cotizaciones por separado toma días", palabra_clave: "días" },
      params: { variante: "pregunta", pregunta: "¿Cansado de esperar cotizaciones?" },
    },
    {
      id: "e3",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      subtitulo: { texto: "Te asesoramos, medimos y cotizamos gratis", palabra_clave: "gratis" },
      params: { titulo: "Así te cotizamos", items: ["Nos cuentas qué necesitas", "Medimos en sitio", "Te cotizamos gratis"] },
    },
    {
      id: "e4",
      bloque: "beneficio",
      tipo: "beneficios_lista",
      duracion_s: 2.5,
      subtitulo: { texto: "Sin compromiso y por WhatsApp", palabra_clave: "compromiso" },
      params: { items: ["Sin compromiso", "Respuesta el mismo día"] },
    },
    {
      id: "e5",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      subtitulo: { texto: "Pide tu cotización gratis hoy", palabra_clave: "gratis" },
      params: { accion: "formulario", texto_boton: "Pide tu cotización gratis" },
    },
  ],
});
