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
    color_primario: "#26A69A",
    color_secundario: "#4DB6AC",
    fuente: "moderna",
    logo_url: null,
    nombre_marca: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2,
      params: { texto: "¿Todavía lo estás pensando?", palabra_clave: "pensando", media_id: "demo-1", tratamiento: "tarjeta" },
    },
    {
      id: "e2",
      bloque: "objecion",
      tipo: "objecion_respuesta",
      duracion_s: 3,
      params: { objecion: "¿Y si no me queda?", respuesta: "Cambio gratis en 30 días" },
    },
    {
      id: "e3",
      bloque: "producto",
      tipo: "producto_hero",
      duracion_s: 3,
      subtitulo: { texto: "Sigue disponible en tu talla", palabra_clave: "disponible" },
      params: { media_id: "demo-1", nombre: "Chaqueta Impermeable", tratamiento: "celular" },
    },
    {
      id: "e4",
      bloque: "oferta",
      tipo: "oferta_precio",
      duracion_s: 2.5,
      params: { precio: "$149.900", nota: "Envío gratis hoy" },
    },
    {
      id: "e5",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      params: { accion: "web", texto_boton: "Míralo aquí" },
    },
  ],
});
