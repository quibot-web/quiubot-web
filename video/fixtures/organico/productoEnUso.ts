import { GuionSchema } from "../../guion.schema";

// Ejemplo que respeta video/recetas/organico/productoEnUso.ts: producto
// real (producto_hero) y beneficio, cta "suave" sin pedir compra.
export const fixtureProductoEnUso = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  uso: "organico",
  receta_organica: "producto_en_uso",
  duracion_objetivo_s: 18,
  bucle: { texto: "Mira cómo quedó", abre_en: "e1", cierra_en: "e2", indicador: "espera_final" },
  tema: {
    color_primario: "#2E9E6B",
    color_secundario: "#A8E6C9",
    fuente: "amigable",
    logo_url: null,
    nombre_marca: "Vivero Esperanza",
  },
  musica: { pista_id: null, volumen: 0.35 },
  publicacion: {
    caption: "Así quedó este jardín en solo un fin de semana 🌿",
    hashtags: ["#jardineria", "#plantas", "#decohogar", "#vivero"],
  },
  // "demo-1" se resuelve al generar/renderizar de verdad (la pieza
  // elegida del álbum), igual que en los fixtures de anuncio.
  analisisPiezas: {
    "demo-1": { version: 1, tiene_texto: false, es_publicitaria: false, fondo_limpio: true, recuadro_producto: null },
  },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2.2,
      params: { texto: "¿Tu jardín necesita un cambio?", palabra_clave: "cambio" },
    },
    {
      id: "e2",
      bloque: "producto",
      tipo: "producto_hero",
      duracion_s: 5,
      subtitulo: { texto: "Transformamos tu espacio en un fin de semana", palabra_clave: "transformamos" },
      params: { media_id: "demo-1", nombre: "Diseño de jardín", etiqueta: "Antes y después", tratamiento: "tarjeta" },
    },
    {
      id: "e3",
      bloque: "beneficio",
      tipo: "beneficios_lista",
      duracion_s: 5,
      params: { items: ["Plantas que sí sobreviven acá", "Diseño pensado para tu espacio"] },
    },
    {
      id: "e4",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 4.8,
      params: { accion: "suave", texto_boton: "Conócenos", subtexto: "Jardines que sí duran" },
    },
  ],
});
