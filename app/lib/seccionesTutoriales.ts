export const SECCIONES_TUTORIALES = [
  { key: "bienvenida", label: "Bienvenida (video de presentación, público)" },
  { key: "inicio", label: "Inicio" },
  { key: "mi-marca", label: "Mi marca" },

  // Motor de Estrategia: un video por cada uno de los 6 pasos del wizard.
  // El campo "grupo" hace que el panel de admin los muestre agrupados
  // bajo una sola tarjeta desplegable "Motor de Estrategia" en vez de
  // sueltos entre las demás secciones.
  { key: "motor-estrategia-paso1", label: "Paso 1 · ¿Qué vas a promocionar?", grupo: "Motor de Estrategia" },
  { key: "motor-estrategia-paso2-producto", label: "Paso 2 · Sube tu imagen (Producto físico)", grupo: "Motor de Estrategia" },
  { key: "motor-estrategia-paso2-servicio", label: "Paso 2 · Sube tu imagen (Servicio/infoproducto)", grupo: "Motor de Estrategia" },
  { key: "motor-estrategia-paso3", label: "Paso 3 · Objetivo publicitario", grupo: "Motor de Estrategia" },
  { key: "motor-estrategia-paso4", label: "Paso 4 · Presupuesto y generar estrategia", grupo: "Motor de Estrategia" },
  { key: "motor-estrategia-paso5", label: "Paso 5 · Explora y elige tu estrategia", grupo: "Motor de Estrategia" },
  { key: "motor-estrategia-paso6", label: "Paso 6 · Creativos y publicar en Meta", grupo: "Motor de Estrategia" },

  { key: "campanas", label: "Mis Campañas" },
  { key: "album-creativos", label: "Álbum de Creativos" },
  { key: "integraciones-openai", label: "Integraciones · OpenAI" },
  { key: "integraciones-cloudinary", label: "Integraciones · Cloudinary" },
  { key: "integraciones-meta", label: "Integraciones · Meta Ads" },
] as const;