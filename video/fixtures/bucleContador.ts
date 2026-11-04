import { GuionSchema } from "../guion.schema";

// Segundo fixture: cubre lo que el primero no toca -- lista_numerada con
// el bucle en modo "contador" (1/3, 2/3, 3/3) y objecion_respuesta.
export const fixtureBucleContador = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "seguidores_instagram",
  duracion_objetivo_s: 15,
  bucle: {
    texto: "3 trucos para que tu café dure más",
    abre_en: "e1",
    cierra_en: "e2",
    indicador: "contador",
  },
  tema: {
    color_primario: "#C8893F",
    color_secundario: "#D8B48C",
    color_fondo: "#0D0A22",
    color_texto: "#FFFFFF",
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
      subtitulo: { texto: "3 trucos para que tu café dure más", palabra_clave: "trucos" },
      params: { texto: "3 trucos para que tu café dure más", palabra_clave: "trucos" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      subtitulo: { texto: "Guárdalo bien, lejos de la luz y muélelo justo antes", palabra_clave: "lejos" },
      params: {
        titulo: "3 trucos para que dure más",
        items: ["Guárdalo en frasco hermético", "Lejos de la luz y el calor", "Muélelo justo antes de usar"],
      },
    },
    {
      id: "e3",
      bloque: "objecion",
      tipo: "objecion_respuesta",
      duracion_s: 3,
      subtitulo: { texto: "¿Y si no me queda bien? Cambio gratis en 30 días", palabra_clave: "gratis" },
      params: { objecion: "¿Y si no me gusta?", respuesta: "Cambio gratis en 30 días" },
    },
    {
      id: "e4",
      bloque: "marca",
      tipo: "revelacion_marca",
      duracion_s: 2.3,
      subtitulo: { texto: "Café que se disfruta de verdad", palabra_clave: "disfruta" },
      params: { frase: "Café que se disfruta de verdad", mostrar_logo: true },
    },
    {
      id: "e5",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      subtitulo: { texto: "Síguenos para más tips cada semana", palabra_clave: "Síguenos" },
      params: { accion: "seguir", texto_boton: "Síguenos", usuario: "@miempresacafe", subtexto: "Más tips cada semana" },
    },
  ],
});
