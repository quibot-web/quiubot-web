import { GuionSchema } from "../guion.schema";

// Guion de ejemplo genérico para probar visualmente las escenas y capas
// en Remotion Studio (paso 2 de la Fase 1a). Todavía no respeta ninguna
// receta por objetivo -- eso llega en el paso 3, cuando video/recetas/
// exista y pueda validarse aparte. GuionSchema.parse() aquí mismo hace
// de red de seguridad: si el fixture no cumple el esquema, falla al
// importarlo en vez de fallar en silencio dentro de Remotion Studio.
export const fixtureCompleta = GuionSchema.parse({
  version: 1,
  formato: "9x16",
  fps: 30,
  objetivo: "venta_directa_whatsapp",
  duracion_objetivo_s: 19,
  bucle: {
    texto: "Mira cómo quedó la soldadura",
    abre_en: "e1",
    cierra_en: "e6",
    indicador: "espera_final",
  },
  tema: {
    color_primario: "#FF4081",
    color_secundario: "#F48FB1",
    fuente: "impacto",
    logo_url: null,
    nombre_marca: null,
  },
  musica: { pista_id: null, volumen: 0.35 },
  escenas: [
    {
      id: "e1",
      bloque: "gancho",
      tipo: "gancho_texto",
      duracion_s: 2.2,
      params: { texto: "¿Tu soldadora no aguanta el turno?", palabra_clave: "aguanta", sticker: "NUEVO", media_id: "demo-1" },
    },
    {
      id: "e2",
      bloque: "problema",
      tipo: "problema_dato",
      duracion_s: 3,
      params: {
        variante: "dato",
        titulo: "Llevas semanas perdiendo tiempo",
        valor_desde: 0,
        valor_hasta: 0,
        prefijo: "$",
        etiqueta: "en reparaciones este mes",
      },
    },
    {
      id: "e3",
      bloque: "producto",
      tipo: "producto_hero",
      duracion_s: 3.5,
      subtitulo: { texto: "Soldadora inverter 200A, liviana y potente", palabra_clave: "potente" },
      params: { media_id: "demo-1", nombre: "Soldadora Inverter 200A", etiqueta: "Lista para trabajar" },
    },
    {
      id: "e4",
      bloque: "beneficio",
      tipo: "beneficios_lista",
      duracion_s: 3,
      params: { items: ["Liviana y portátil", "Perfora sin esfuerzo"] },
    },
    {
      id: "e5",
      bloque: "oferta",
      tipo: "oferta_precio",
      duracion_s: 2.5,
      params: { precio: "$389.900", precio_antes: "$459.900", nota: "Solo esta semana" },
    },
    {
      id: "e6",
      bloque: "marca",
      tipo: "revelacion_marca",
      duracion_s: 2.3,
      params: { frase: "Hecho para quien trabaja duro", mostrar_logo: true },
    },
    {
      id: "e7",
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
