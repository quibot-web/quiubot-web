// Guion de la conversación guiada con el Director en /bienvenida
// (experiencia de Autopiloto, interruptor encendido) -- separado de
// ConversacionDirector.tsx para poder editar los mensajes, las
// preguntas y el orden sin tocar el componente.
//
// Los precios, el nombre del plan y los días de prueba NUNCA se
// escriben aquí como número: van como "tokens" ({ tipo: "valor",
// cual: ... }) que ConversacionDirector.tsx resuelve en el momento
// contra app/lib/planesConfig.ts. Las únicas cifras literales que
// quedan en este archivo son ejemplos ilustrativos (una meta de
// ejemplo, el costo de un freelancer) o la cifra ya resuelta y fija
// de CUPOS_FUNDADOR, que es una política, no un precio.
import type { AsistenteId } from "@/app/components/esferas/esferasShared";

export type ValorToken =
  | "precioAutopilotoPrincipal" // precio de fundador si hay cupos, si no el normal
  | "precioAutopilotoNormal" // siempre el precio normal (para el tachado)
  | "precioCrecimiento"
  | "diasPrueba"
  | "nombreAutopiloto";

export type ParteMensaje =
  | { tipo: "texto"; texto: string }
  | { tipo: "fuerte"; texto: string }
  | { tipo: "salto" }
  | { tipo: "valor"; cual: ValorToken; fuerte?: boolean };

// Bloques especiales que ConversacionDirector.tsx arma con datos en
// vivo (equipo, precios, cupos) en vez de con partes de texto sueltas.
export type Mensaje =
  | { tipo: "texto"; partes: ParteMensaje[] }
  | { tipo: "lista" }
  | { tipo: "precio" }
  | { tipo: "planes" }
  | { tipo: "propuesta" };

export type IdPregunta =
  | "inicio"
  | "que"
  | "ventas"
  | "precio"
  | "cual"
  | "equipo_hace"
  | "yo_mismo"
  | "conocer"
  | "control"
  | "novato"
  | "necesito"
  | "negocio"
  | "cancelar"
  | "mas";

export type Respuesta = {
  // Ausente solo en "inicio" -- las demás son botones reales, su
  // texto es la etiqueta del botón.
  pregunta?: string;
  // Qué esferas se encienden mientras se muestran estos mensajes.
  luz: AsistenteId[];
  mensajes: Mensaje[];
  // Variante a usar cuando NO quedan cupos de fundador -- solo la
  // llevan las respuestas que narran el precio de fundador en texto
  // corrido (no en el bloque "precio"/"planes", que ya se resuelven
  // solos en el componente). Si falta, se usa "mensajes" igual.
  mensajesSinFundador?: Mensaje[];
  // "empezar" es un botón especial, no una entrada real de GUION (ver
  // ConversacionDirector.tsx) -- puede aparecer explícito aquí, o se
  // agrega solo después de 2 respuestas si todavía no apareció.
  siguientes: (IdPregunta | "empezar")[] | null;
};

const t = (texto: string): ParteMensaje => ({ tipo: "texto", texto });
const b = (texto: string): ParteMensaje => ({ tipo: "fuerte", texto });
const br: ParteMensaje = { tipo: "salto" };
const v = (cual: ValorToken, fuerte?: boolean): ParteMensaje => ({ tipo: "valor", cual, fuerte });

// "X días" como una sola unidad en negrita (días + la palabra
// "gratis" al lado), usado donde el guion original resalta la
// duración completa de la prueba, no solo el número.
const diasGratisFuerte = (sufijo: string): ParteMensaje[] => [v("diasPrueba", true), { tipo: "fuerte", texto: ` días ${sufijo}` }];

export const GUION: Record<IdPregunta, Respuesta> = {
  inicio: {
    luz: ["director"],
    mensajes: [
      { tipo: "texto", partes: [t("¡Quiubo! Soy el "), b("Director"), t(" de tu nuevo equipo de publicidad.")] },
      {
        tipo: "texto",
        partes: [
          t(
            "Somos 7 asistentes con inteligencia artificial. Conseguimos clientes para tu negocio en Facebook e Instagram mientras tú atiendes. ¿Qué quieres saber?"
          ),
        ],
      },
    ],
    siguientes: ["que", "ventas", "precio", "control", "novato"],
  },

  que: {
    pregunta: "¿Qué hacen exactamente?",
    luz: ["marca", "estratega", "creativo", "publicador", "analista", "optimizador"],
    mensajes: [
      {
        tipo: "texto",
        partes: [t('Te lo explico fácil. Tú me dices tu meta, por ejemplo '), b('"40 conversaciones de WhatsApp este mes"'), t(". Y el equipo se reparte el trabajo:")],
      },
      { tipo: "lista" },
    ],
    siguientes: ["empezar", "ventas", "control", "precio"],
  },

  ventas: {
    pregunta: "Mis anuncios no me traen clientes",
    luz: ["estratega", "analista", "optimizador"],
    mensajes: [
      { tipo: "texto", partes: [t("Pasa muchísimo, y casi nunca es culpa tuya. Suele ser una de tres cosas:")] },
      {
        tipo: "texto",
        partes: [
          t("1. Todos tus anuncios dicen lo mismo, y Meta los trata como si fueran uno solo."),
          br,
          t("2. Nadie los revisa cuando dejan de funcionar, y siguen gastando."),
          br,
          t("3. Le hablan a todo el mundo en vez de a tu cliente."),
        ],
      },
      {
        tipo: "texto",
        partes: [
          t("Mi equipo ataca las tres: anuncios con ideas "),
          b("realmente distintas"),
          t(", revisión "),
          b("todos los días"),
          t(" y cambios explicados con números."),
        ],
      },
    ],
    siguientes: ["empezar", "control", "que", "precio"],
  },

  precio: {
    pregunta: "¿Cuánto cuesta?",
    luz: ["director"],
    mensajes: [
      {
        tipo: "texto",
        partes: [
          t(
            "Un freelancer de pauta en Colombia cobra desde $500.000 al mes, y una agencia desde $2.000.000. Nosotros tenemos tres planes, y puedes empezar gratis. El que te recomiendo es "
          ),
          b("Autopiloto"),
          t(", porque es el único con el equipo completo trabajando por ti:"),
        ],
      },
      { tipo: "planes" },
      {
        tipo: "texto",
        partes: [t("Aparte, tus anuncios los pagas directo a Meta y el uso de IA directo a OpenAI, "), b("sin ningún margen nuestro"), t(".")],
      },
    ],
    siguientes: ["cual", "empezar", "control", "que"],
  },

  cual: {
    pregunta: "¿Cuál plan es para mí?",
    luz: ["director"],
    mensajes: [{ tipo: "texto", partes: [t("Depende de una sola cosa. ¿Cómo prefieres trabajar?")] }],
    siguientes: ["equipo_hace", "yo_mismo", "conocer"],
  },

  equipo_hace: {
    pregunta: "Que el equipo lo haga por mí",
    luz: ["marca", "estratega", "creativo", "publicador", "analista", "optimizador"],
    mensajes: [
      {
        tipo: "texto",
        partes: [
          t("Entonces es "),
          b("Autopiloto"),
          t(": tú dices tu meta y apruebas; el equipo hace todo lo demás. Como fundador pagas "),
          v("precioAutopilotoPrincipal"),
          t(" al mes, menos de $10.000 al día, y los primeros "),
          v("diasPrueba"),
          t(" días son gratis."),
        ],
      },
    ],
    mensajesSinFundador: [
      {
        tipo: "texto",
        partes: [
          t("Entonces es "),
          b("Autopiloto"),
          t(": tú dices tu meta y apruebas; el equipo hace todo lo demás. Pagas "),
          v("precioAutopilotoNormal"),
          t(" al mes, menos de $14.000 al día, y los primeros "),
          v("diasPrueba"),
          t(" días son gratis."),
        ],
      },
    ],
    siguientes: ["empezar", "control", "necesito"],
  },

  yo_mismo: {
    pregunta: "Prefiero hacerlo yo, con ayuda",
    luz: ["estratega", "creativo"],
    mensajes: [
      {
        tipo: "texto",
        partes: [
          t("Entonces "),
          b("Crecimiento"),
          t(" ("),
          v("precioCrecimiento"),
          t(" al mes): tienes las herramientas para crear estrategias y anuncios con IA, y tú decides cuándo y cómo publicar."),
        ],
      },
      { tipo: "texto", partes: [t("Si algún día no tienes tiempo, pasas a Autopiloto y el equipo toma el control. Sin perder nada de lo que hiciste.")] },
    ],
    siguientes: ["empezar", "equipo_hace", "necesito"],
  },

  conocer: {
    pregunta: "Solo quiero conocerlo primero",
    luz: ["director"],
    mensajes: [
      {
        tipo: "texto",
        partes: [t("Perfecto. Empieza con los "), ...diasGratisFuerte("gratis"), t(": conoces al equipo trabajando con tu negocio, sin tarjeta.")],
      },
      {
        tipo: "texto",
        partes: [t("Si después no quieres pagar, sigues en "), b("Arranque"), t(", gratis para siempre, con una estrategia al mes.")],
      },
    ],
    siguientes: ["empezar", "control", "que"],
  },

  control: {
    pregunta: "¿Y si gastan mi plata sin preguntarme?",
    luz: ["director", "optimizador"],
    mensajes: [
      {
        tipo: "texto",
        partes: [b("Nunca."), t(' Ningún anuncio se publica y ningún presupuesto cambia sin que tú digas "Sí, adelante". Así te llegan las propuestas:')],
      },
      { tipo: "propuesta" },
      { tipo: "texto", partes: [t("Además le pones un tope a tu meta, y jamás te propongo pasarlo.")] },
    ],
    siguientes: ["empezar", "novato", "precio", "cancelar"],
  },

  novato: {
    pregunta: "No sé nada de publicidad",
    luz: ["director"],
    mensajes: [
      { tipo: "texto", partes: [t("Mejor así. No tienes que aprender nada: yo te hablo claro y con números simples.")] },
      { tipo: "texto", partes: [t("Tu único trabajo es decir "), b("sí"), t(" o "), b("no"), t(". El resto lo hace el equipo.")] },
    ],
    siguientes: ["empezar", "necesito", "que", "precio"],
  },

  necesito: {
    pregunta: "¿Qué necesito para empezar?",
    luz: ["director", "marca"],
    mensajes: [
      {
        tipo: "texto",
        partes: [t("Tres cosas: tu cuenta de Facebook con la página de tu negocio, una cuenta de OpenAI (te guiamos paso a paso) y unas fotos de tu producto. Con eso arrancamos.")],
      },
    ],
    siguientes: ["empezar", "negocio", "precio"],
  },

  negocio: {
    pregunta: "¿Sirve para mi tipo de negocio?",
    luz: ["estratega"],
    mensajes: [
      {
        tipo: "texto",
        partes: [
          t("Si vendes por WhatsApp o quieres que tus clientes te dejen sus datos, sí: tiendas, restaurantes, servicios, salud y belleza, talleres… Lo mejor es probarlo con tu propio negocio. Son "),
          v("diasPrueba"),
          t(" días gratis."),
        ],
      },
    ],
    siguientes: ["empezar", "control", "precio"],
  },

  cancelar: {
    pregunta: "¿Puedo cancelar cuando quiera?",
    luz: ["director"],
    mensajes: [{ tipo: "texto", partes: [t("Cuando quieras, sin permanencia. Y tus campañas se quedan en tu cuenta de Meta: son tuyas.")] }],
    siguientes: ["empezar", "que", "precio"],
  },

  mas: {
    pregunta: "Primero cuéntame más",
    luz: ["director"],
    mensajes: [{ tipo: "texto", partes: [t("¡Claro! Pregúntame lo que quieras.")] }],
    siguientes: null,
  },
};

export const ETIQUETA_OPCION: Record<string, string> = {
  empezar: "Quiero empezar gratis",
};

// La oferta que aparece a mitad de la conversación (después de 2
// respuestas), y el botón que la acompaña.
export const OFERTA_MEDIO = {
  partes: [
    t("¿Quieres que empecemos con tu negocio? Empezamos hoy mismo con tu negocio. Son "),
    v("diasPrueba"),
    t(" días gratis, sin tarjeta."),
  ] as ParteMensaje[],
};

// Lo que dice el Director cuando alguien toca "Quiero empezar gratis".
export const RESPUESTA_EMPEZAR: ParteMensaje[] = [t("Quiero empezar gratis")];

// Contenido del bloque "lista" (qué hace cada asistente), usado en la
// respuesta "que".
export const LISTA_EQUIPO: { id: AsistenteId; texto: string }[] = [
  { id: "marca", texto: "El Analista de marca aprende tu estilo y tus colores." },
  { id: "estratega", texto: "El Estratega arma la campaña con ideas distintas." },
  { id: "creativo", texto: "El Creativo diseña los anuncios con tu producto real." },
  { id: "publicador", texto: "El Publicador los sube a tu cuenta de Meta." },
  { id: "analista", texto: "El Analista de campañas revisa los resultados cada día." },
  { id: "optimizador", texto: "El Optimizador me dice qué mejorar, y yo te lo propongo." },
];

// Ejemplo ilustrativo de propuesta, usado en la respuesta "control" --
// cifras de ejemplo, no datos reales de ningún cliente.
export const EJEMPLO_PROPUESTA = {
  titulo: 'Subir 20 % el presupuesto de "Domicilios"',
  texto: "Consigue conversaciones a $9.800, por debajo de tu objetivo de $15.000. A este ritmo llegarías a tu meta.",
  respuestas: ["Sí, adelante", "Ajustar", "No por ahora"],
};

// Nombres cortos para la fila de 7 esferas (más compactos que
// NOMBRE_ASISTENTE de directorChat.ts, que es la fuente para el resto
// de la app -- aquí hay menos espacio horizontal).
export const NOMBRE_CORTO: Record<AsistenteId, string> = {
  director: "Director",
  marca: "Marca",
  estratega: "Estratega",
  creativo: "Creativo",
  publicador: "Publicador",
  analista: "Analista",
  optimizador: "Optimizador",
};

// Orden de la fila de esferas -- el Director en el centro, como en la
// maqueta.
export const ORDEN_EQUIPO: AsistenteId[] = ["marca", "estratega", "creativo", "director", "publicador", "analista", "optimizador"];

// --- Textos del resto de la experiencia (fuera del chat), también
// editables aquí sin tocar los componentes. ---

export const TITULO = {
  eyebrow: "Publicidad en Facebook e Instagram, sin complicarte",
  h1Inicio: "Conoce al equipo que va a conseguirle ",
  h1Enfasis: "clientes a tu negocio.",
};

export const GARANTIAS = ["Nada se publica sin tu aprobación", "Cancelas cuando quieras"];

export const PASOS_FACIL = [
  { numero: "PASO 1", titulo: "Dices tu meta", texto: '"Quiero 40 conversaciones de WhatsApp este mes, sin gastar más de $1.000.000."' },
  { numero: "PASO 2", titulo: "El equipo trabaja", texto: "Aprende tu marca, crea los anuncios con tu producto real, los publica y los revisa todos los días." },
  { numero: "PASO 3", titulo: "Tú apruebas", texto: "El Director te explica cada mejora con números. Un toque y se aplica. O dices que no." },
];

export const PRECIOS_SECCION = {
  titulo: "Un equipo completo de publicidad, por menos de lo que cobra un freelancer",
  notaFreelancer:
    "Un freelancer de pauta en Colombia cobra entre $500.000 y $3.000.000 al mes, y una agencia desde $2.000.000. Autopiloto trabaja todos los días por tu meta, sin inversión mínima y sin porcentaje sobre lo que inviertes.",
  notaCostos: "Los anuncios los pagas directo a Meta y el uso de IA directo a OpenAI, sin margen nuestro. Paga el año y recibe 2 meses gratis.",
  taglineArranque: "Para conocer Quiubot. Una estrategia al mes con IA.",
  taglineCrecimiento: "Lo haces tú, con nuestras herramientas de estrategia y anuncios con IA.",
  taglineAutopiloto: "El equipo completo trabajando por tu meta todos los días. Tú solo apruebas.",
};

export const CIERRE = {
  h2: "Tu equipo está listo. Solo falta tu meta.",
  micro: "Sin tarjeta de crédito · Cancelas cuando quieras",
};
