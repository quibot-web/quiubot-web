import { GuionSchema } from "../../guion.schema";

// Ejemplo que respeta video/recetas/organico/mitoVerdad.ts: objecion
// bloque permitido, cta "comentar" (sin @usuario).
export const fixtureMitoVerdad = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  uso: "organico",
  receta_organica: "mito_verdad",
  duracion_objetivo_s: 17,
  bucle: { texto: "¿De verdad hay que pintar antes de lijar?", abre_en: "e1", cierra_en: "e3", indicador: "espera_final" },
  tema: {
    color_primario: "#3F6FB5",
    color_secundario: "#9DB4FF",
    fuente: "moderna",
    logo_url: null,
    nombre_marca: "Ferretería Central",
  },
  musica: { pista_id: null, volumen: 0.35 },
  publicacion: {
    caption: "¿Tú también creías esto? 👀 Comenta MITO si ya lo sabías.",
    hashtags: ["#ferreteria", "#tipsdehogar", "#mitoyverdad"],
  },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2.3,
      params: { texto: "¿Hay que lijar siempre antes de pintar?", palabra_clave: "lijar" },
    },
    {
      id: "e2",
      bloque: "objecion",
      tipo: "objecion_respuesta",
      duracion_s: 4.5,
      params: { objecion: "Si ya está lisa, no hace falta", respuesta: "Siempre lija: se agarra mejor" },
    },
    {
      id: "e3",
      bloque: "objecion",
      tipo: "objecion_respuesta",
      duracion_s: 5,
      params: { objecion: "El spray rinde menos que la brocha", respuesta: "Rinde igual, aplica en capas finas" },
    },
    {
      id: "e4",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 5,
      params: { accion: "comentar", texto_boton: "¿Tú también lo creías?", palabra_clave_comentario: "MITO" },
    },
  ],
});
