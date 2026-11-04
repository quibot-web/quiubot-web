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
    color_primario: "#66BB6A",
    color_secundario: "#81C784",
    fuente: "moderna",
    logo_url: null,
    nombre_marca: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2,
      params: { texto: "La colección que se agota rápido", palabra_clave: "agota", sticker: "-20%", media_id: "demo-1" },
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
      params: { items: ["Cuero 100% real", "Envío gratis a todo el país"] },
    },
    {
      id: "e4",
      bloque: "oferta",
      tipo: "oferta_precio",
      duracion_s: 2.5,
      params: { precio: "$189.900", precio_antes: "$239.900", nota: "Hasta agotar existencias" },
    },
    {
      id: "e5",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.5,
      params: { accion: "web", texto_boton: "Compra aquí" },
    },
  ],
});
