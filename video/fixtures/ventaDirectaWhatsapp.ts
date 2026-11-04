import { GuionSchema } from "../guion.schema";

// Ejemplo que respeta la receta de video/recetas/ventaDirectaWhatsapp.ts.
export const fixtureVentaDirectaWhatsapp = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "venta_directa_whatsapp",
  duracion_objetivo_s: 15,
  bucle: { texto: "Mira cómo quedó la soldadura", abre_en: "e1", cierra_en: "e3", indicador: "espera_final" },
  tema: {
    color_primario: "#FF4081",
    color_secundario: "#F48FB1",
    fuente: "impacto",
    logo_url: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2,
      params: { texto: "¿Tu soldadora no aguanta el turno?", palabra_clave: "aguanta", media_id: "demo-1" },
    },
    {
      id: "e2",
      bloque: "problema",
      tipo: "problema_dato",
      duracion_s: 2.5,
      params: { variante: "dato", titulo: "Llevas semanas perdiendo tiempo", valor_desde: 0, valor_hasta: 0, prefijo: "$" },
    },
    {
      id: "e3",
      bloque: "producto",
      tipo: "producto_hero",
      duracion_s: 3.5,
      subtitulo: { texto: "Soldadora inverter 200A, lista para trabajar", palabra_clave: "lista" },
      params: { media_id: "demo-1", nombre: "Soldadora Inverter 200A" },
    },
    {
      id: "e4",
      bloque: "beneficio",
      tipo: "beneficios_lista",
      duracion_s: 2.5,
      params: { items: ["Liviana y portátil", "Perfora sin esfuerzo"] },
    },
    {
      id: "e5",
      bloque: "oferta",
      tipo: "oferta_precio",
      duracion_s: 2.5,
      params: { precio: "$389.900", precio_antes: "$459.900" },
    },
    {
      id: "e6",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      params: {
        accion: "whatsapp",
        texto_boton: "Escríbenos por WhatsApp",
        mensajes: ["Hola, vi el anuncio", "¿Tienen disponible?"],
      },
    },
  ],
});
