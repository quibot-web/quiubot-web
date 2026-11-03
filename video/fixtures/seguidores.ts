import { GuionSchema } from "../guion.schema";

// Ejemplo que respeta la receta compartida de video/recetas/seguidores.ts
// (seguidores_facebook y seguidores_instagram).
export const fixtureSeguidoresInstagram = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "seguidores_instagram",
  duracion_objetivo_s: 9,
  bucle: { texto: "Parte 1 de 3 trucos de edición", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
  tema: {
    color_primario: "#C2185B",
    color_secundario: "#F06292",
    color_fondo: "#0D0A22",
    color_texto: "#FFFFFF",
    fuente: "amigable",
    logo_url: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2,
      subtitulo: { texto: "3 trucos de edición que no conocías", palabra_clave: "trucos" },
      params: { texto: "3 trucos de edición que no conocías", palabra_clave: "trucos" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      subtitulo: { texto: "Luz natural, encuadre y el tercero en la parte 2", palabra_clave: "encuadre" },
      params: { titulo: "3 trucos de edición", items: ["Usa luz natural", "Cuida el encuadre", "El tercero, síguenos"] },
    },
    {
      id: "e3",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      subtitulo: { texto: "Síguenos para la parte 2", palabra_clave: "Síguenos" },
      params: { accion: "seguir", texto_boton: "Síguenos", usuario: "@miempresa", subtexto: "Más tips cada semana" },
    },
  ],
});
