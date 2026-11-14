import { GuionSchema } from "../../guion.schema";

// Ejemplo que respeta video/recetas/organico/seriePartes.ts. La "parte
// 2" real la decide el calendario (/contenido), acá solo se nombra en
// el texto -- este guion es autocontenido, como cualquier otro.
export const fixtureSeriePartes = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  uso: "organico",
  receta_organica: "serie_partes",
  duracion_objetivo_s: 18,
  bucle: { texto: "Parte 1 de 3: cómo elegir tu primera soldadora", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
  tema: {
    color_primario: "#D14724",
    color_secundario: "#F4A860",
    fuente: "impacto",
    logo_url: null,
    nombre_marca: "Ferretería Central",
  },
  musica: { pista_id: null, volumen: 0.35 },
  publicacion: {
    caption: "Parte 1 de 3: cómo elegir tu primera soldadora. Sigue la cuenta para la parte 2 🔧",
    hashtags: ["#ferreteria", "#soldadura", "#herramientas", "#tipsdetaller"],
  },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2.3,
      params: { texto: "¿Vas a comprar tu primera soldadora?", palabra_clave: "primera" },
    },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 5,
      params: {
        titulo: "Parte 1: lo primero que hay que mirar",
        items: ["El amperaje que necesita tu trabajo", "Si es inverter o transformador", "Que tenga protección térmica"],
      },
    },
    {
      id: "e3",
      bloque: "valor",
      tipo: "beneficios_lista",
      duracion_s: 5,
      params: { titulo: "En la parte 2", items: ["Cómo probarla antes de comprar", "Los accesorios que sí necesitas"] },
    },
    {
      id: "e4",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 5,
      params: { accion: "seguir", texto_boton: "Seguir", usuario: "@ferreteriacentral", subtexto: "Sigue para la parte 2" },
    },
  ],
});
