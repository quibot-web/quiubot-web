import { GuionSchema } from "../../guion.schema";

// Ejemplo que respeta video/recetas/organico/preguntaComunidad.ts: la
// única receta que usa la escena nueva dos_opciones.
export const fixturePreguntaComunidad = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  uso: "organico",
  receta_organica: "pregunta_comunidad",
  duracion_objetivo_s: 14,
  bucle: { texto: "¿Café o té en las mañanas?", abre_en: "e1", cierra_en: "e2", indicador: "espera_final" },
  tema: {
    color_primario: "#C8893F",
    color_secundario: "#6B9080",
    fuente: "amigable",
    logo_url: null,
    nombre_marca: "Café Luna",
  },
  musica: { pista_id: null, volumen: 0.35 },
  publicacion: {
    caption: "¿De qué equipo eres? ☕️🍵 Déjanos tu respuesta en los comentarios.",
    hashtags: ["#cafe", "#te", "#comunidad", "#cafeluna"],
  },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2.2,
      params: { texto: "¿Café o té en las mañanas?", palabra_clave: "café" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "dos_opciones",
      duracion_s: 4.8,
      params: { opcion_a: "Café bien cargado", opcion_b: "Té suave" },
    },
    {
      id: "e3",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 5,
      params: { accion: "comentar", texto_boton: "Comenta tu opción", palabra_clave_comentario: "CAFÉ" },
    },
  ],
});
