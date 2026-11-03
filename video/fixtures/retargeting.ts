import { GuionSchema } from "../guion.schema";

// Ejemplo que respeta la receta de video/recetas/retargeting.ts.
export const fixtureRetargeting = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "retargeting",
  duracion_objetivo_s: 13,
  bucle: { texto: "¿Todavía lo estás pensando?", abre_en: "e1", cierra_en: "e2", indicador: "espera_final" },
  tema: {
    color_primario: "#00796B",
    color_secundario: "#4DB6AC",
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
      subtitulo: { texto: "¿Todavía lo estás pensando?", palabra_clave: "pensando" },
      params: { texto: "¿Todavía lo estás pensando?", palabra_clave: "pensando" },
    },
    {
      id: "e2",
      bloque: "objecion",
      tipo: "objecion_respuesta",
      duracion_s: 3,
      subtitulo: { texto: "¿Y si no me queda? Cambio gratis en 30 días", palabra_clave: "gratis" },
      params: { objecion: "¿Y si no me queda?", respuesta: "Cambio gratis en 30 días" },
    },
    {
      id: "e3",
      bloque: "producto",
      tipo: "producto_hero",
      duracion_s: 3,
      subtitulo: { texto: "Sigue disponible en tu talla", palabra_clave: "disponible" },
      params: { media_id: "demo-1", nombre: "Chaqueta Impermeable" },
    },
    {
      id: "e4",
      bloque: "oferta",
      tipo: "oferta_precio",
      duracion_s: 2.5,
      subtitulo: { texto: "Hoy con envío gratis", palabra_clave: "gratis" },
      params: { precio: "$149.900", nota: "Envío gratis hoy" },
    },
    {
      id: "e5",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      subtitulo: { texto: "Míralo aquí", palabra_clave: "Míralo" },
      params: { accion: "web", texto_boton: "Míralo aquí" },
    },
  ],
});
