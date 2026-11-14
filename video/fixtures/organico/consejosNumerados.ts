import { GuionSchema } from "../../guion.schema";

// Ejemplo que respeta video/recetas/organico/consejosNumerados.ts:
// requiere revelacion_marca, bucle "contador" cerrando en la
// lista_numerada, cta "seguir" con @usuario.
export const fixtureConsejosNumerados = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  uso: "organico",
  receta_organica: "consejos_numerados",
  duracion_objetivo_s: 17,
  bucle: { texto: "3 consejos para que tu pan dure más fresco", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
  tema: {
    color_primario: "#C8893F",
    color_secundario: "#D8B48C",
    fuente: "amigable",
    logo_url: null,
    nombre_marca: "Panadería Luna",
  },
  musica: { pista_id: null, volumen: 0.35 },
  publicacion: {
    caption: "3 trucos de panadería que casi nadie conoce 🍞 Guarda este post para cuando lo necesites.",
    hashtags: ["#panaderia", "#tipsdecocina", "#pancasero", "#recetasfaciles"],
  },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2.2,
      params: { texto: "¿Tu pan se pone duro al otro día?", palabra_clave: "duro" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      params: {
        titulo: "3 trucos para que dure fresco",
        items: ["Guárdalo en bolsa de tela, no plástico", "Nunca en la nevera", "Congélalo en rebanadas"],
      },
    },
    {
      id: "e3",
      bloque: "marca",
      tipo: "revelacion_marca",
      duracion_s: 5,
      params: { frase: "Pan recién horneado, todos los días", mostrar_logo: true },
    },
    {
      id: "e4",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 4.5,
      params: { accion: "seguir", texto_boton: "Seguir", usuario: "@panaderialuna", subtexto: "Más tips de panadería" },
    },
  ],
});
