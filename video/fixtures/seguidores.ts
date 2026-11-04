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
    color_primario: "#FCE4EC",
    color_secundario: "#AD1457",
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
      params: { texto: "3 trucos de edición que no conocías", palabra_clave: "trucos" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      params: { titulo: "3 trucos de edición", items: ["Usa luz natural", "Cuida el encuadre", "El tercero, síguenos"] },
    },
    {
      id: "e3",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      params: { accion: "seguir", texto_boton: "Síguenos", usuario: "@miempresa", subtexto: "Más tips cada semana" },
    },
  ],
});
