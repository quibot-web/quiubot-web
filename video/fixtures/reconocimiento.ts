import { GuionSchema } from "../guion.schema";

// Ejemplo que respeta la receta de video/recetas/reconocimiento.ts:
// requiere revelacion_marca, y el bucle "contador" cierra en la
// lista_numerada del bloque de valor.
export const fixtureReconocimiento = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "reconocimiento",
  duracion_objetivo_s: 12,
  bucle: { texto: "3 trucos para que tu café dure más", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
  tema: {
    color_primario: "#C8893F",
    color_secundario: "#D8B48C",
    fuente: "elegante",
    logo_url: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2,
      params: { texto: "3 trucos para que tu café dure más", palabra_clave: "trucos" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      params: {
        titulo: "3 trucos para que dure más",
        items: ["Guárdalo en frasco hermético", "Lejos de la luz y el calor", "Muélelo justo antes de usar"],
      },
    },
    {
      id: "e3",
      bloque: "marca",
      tipo: "revelacion_marca",
      duracion_s: 2.3,
      params: { frase: "Café que se disfruta de verdad", mostrar_logo: true },
    },
    {
      id: "e4",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      params: { accion: "suave", texto_boton: "Conócenos" },
    },
  ],
});
