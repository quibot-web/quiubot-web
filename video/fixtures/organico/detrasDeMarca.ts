import { GuionSchema } from "../../guion.schema";

// Ejemplo que respeta video/recetas/organico/detrasDeMarca.ts: valor
// (beneficios_lista con los valores de la marca) + revelacion_marca
// obligatoria, cta "suave".
export const fixtureDetrasDeMarca = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  uso: "organico",
  receta_organica: "detras_de_marca",
  duracion_objetivo_s: 18,
  bucle: { texto: "Por qué empezamos este negocio", abre_en: "e1", cierra_en: "e3", indicador: "espera_final" },
  tema: {
    color_primario: "#534AB7",
    color_secundario: "#9B8FE8",
    fuente: "elegante",
    logo_url: null,
    nombre_marca: "Taller Hormiga",
  },
  musica: { pista_id: null, volumen: 0.35 },
  publicacion: {
    caption: "La historia detrás de Taller Hormiga 🐜 Gracias por acompañarnos.",
    hashtags: ["#detrasdemarca", "#emprendimiento", "#tallerhormiga"],
  },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2.3,
      params: { texto: "¿Sabes por qué empezamos este negocio?", palabra_clave: "por qué" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "beneficios_lista",
      duracion_s: 5,
      params: { titulo: "Lo que nos mueve", items: ["Trabajo hecho a mano, sin prisa", "Materiales que de verdad duran"] },
    },
    {
      id: "e3",
      bloque: "marca",
      tipo: "revelacion_marca",
      duracion_s: 5,
      params: { frase: "Hecho con las manos, pensado para durar", mostrar_logo: true },
    },
    {
      id: "e4",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 5,
      params: { accion: "suave", texto_boton: "Conócenos", subtexto: "Gracias por acompañarnos" },
    },
  ],
});
