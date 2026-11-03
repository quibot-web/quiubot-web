import { GuionSchema } from "../guion.schema";

// Ejemplo que respeta la receta de video/recetas/ventaDirectaWeb.ts.
export const fixtureVentaDirectaWeb = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "venta_directa_web",
  duracion_objetivo_s: 13,
  bucle: { texto: "Hasta agotar existencias", abre_en: "e1", cierra_en: "e4", indicador: "espera_final" },
  tema: {
    color_primario: "#2E7D32",
    color_secundario: "#81C784",
    color_fondo: "#0D0A22",
    color_texto: "#FFFFFF",
    fuente: "moderna",
    logo_url: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2,
      subtitulo: { texto: "La colección que se agota rápido", palabra_clave: "agota" },
      params: { texto: "La colección que se agota rápido", palabra_clave: "agota", sticker: "-20%" },
    },
    {
      id: "e2",
      bloque: "producto",
      tipo: "producto_hero",
      duracion_s: 3,
      subtitulo: { texto: "Hecho a mano, edición limitada", palabra_clave: "limitada" },
      params: { media_id: "demo-1", nombre: "Bolso Aurora" },
    },
    {
      id: "e3",
      bloque: "beneficio",
      tipo: "beneficios_lista",
      duracion_s: 2.5,
      subtitulo: { texto: "Cuero real, envío gratis a todo el país", palabra_clave: "gratis" },
      params: { items: ["Cuero 100% real", "Envío gratis a todo el país"] },
    },
    {
      id: "e4",
      bloque: "oferta",
      tipo: "oferta_precio",
      duracion_s: 2.5,
      subtitulo: { texto: "Hoy a $189.900, antes $239.900", palabra_clave: "189.900" },
      params: { precio: "$189.900", precio_antes: "$239.900", nota: "Hasta agotar existencias" },
    },
    {
      id: "e5",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      subtitulo: { texto: "Compra aquí antes de que se agote", palabra_clave: "Compra" },
      params: { accion: "web", texto_boton: "Compra aquí" },
    },
  ],
});
