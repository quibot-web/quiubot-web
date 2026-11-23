import { z } from "zod";
import { LIMITE_IDEA } from "./ideaUsuario";
import { GANCHO_TIPOS_ORGANICO, RECETAS_ORGANICAS_IDS, type GanchoTipoOrganico, type RecetaOrganicaId } from "@/video/guion.schema";
import { fechaBogota, inicioDiaBogota } from "@/app/lib/fechaBogota";

// Fase O1, contenido orgánico -- ver docs/diseno/plan_contenido_organico.md.

export const ESTADOS_CONTENIDO = [
  "borrador",
  "generando",
  "aprobada",
  "renderizando",
  "lista",
  "publicando",
  "procesando",
  "publicada",
  "error",
  "vencida",
  "cancelada",
] as const;
export type EstadoContenido = (typeof ESTADOS_CONTENIDO)[number];

export interface PublicacionOrganica {
  id: string;
  user_id: string;
  plataforma: "instagram" | "tiktok";
  receta_organica: RecetaOrganicaId;
  producto_id: string | null;
  // Fotos o videos del álbum elegidos para esta pieza (hasta 3, commit
  // 4b.2) -- se resuelven a URL real recién al generar el guion y al
  // mostrar la revisión, igual que medios en video/guion.schema.ts.
  media_ids: string[] | null;
  // Tema puntual pedido para esta pieza (ej. "por qué tus anuncios no
  // traen mensajes") -- opcional, editable en "Agregar reel" y en la
  // revisión antes de generar el guion. Lo llenará el Director en el
  // commit 7.
  tema: string | null;
  // Asignado por el código al CREAR la pieza (ver
  // elegirGanchoTipoMenosUsado), nunca elegido por la IA -- pedido
  // explícito tras ver que, dejado a su criterio, el modelo repetía el
  // mismo tipo de gancho varias veces en la misma semana.
  gancho_tipo: GanchoTipoOrganico | null;
  guion: unknown;
  caption: string | null;
  hashtags: string[] | null;
  programada_para: string;
  estado: EstadoContenido;
  generando_desde: string | null;
  url_video: string | null;
  cloudinary_public_id: string | null;
  album_id: string | null;
  ig_container_id: string | null;
  ig_media_id: string | null;
  permalink: string | null;
  error: string | null;
  tipo_error: string | null;
  // Resultado del control de calidad (paso 3 de la integración de
  // Fase B v2.0): {crudo} mientras se genera (para poder recompactar
  // sin IA), {aprobado, forzado?, hallazgos?, publicarIgual?} tras
  // render+QC. aprobado===false con estado "lista" es "forzado, no
  // aprobado" -- nunca se trata como una aprobación real.
  control_calidad: { aprobado?: boolean; forzado?: boolean; hallazgos?: unknown[]; publicarIgual?: boolean; crudo?: unknown; forzarSinCalidad?: boolean } | null;
  intentos: number;
  // Estado que tenía al pasar a "vencida" (lo llena el código, ver
  // vencerPiezasSinVideo) -- decide a dónde vuelve al reprogramarla.
  estado_antes_de_vencer: EstadoContenido | null;
  semana: string;
  continua_de_id: string | null;
  creado_en: string;
  actualizado_en: string;
}

// Mismo nombre de columna real en publicaciones_organicas, en el mismo
// orden que la interfaz de arriba -- fuente real para
// `npm run verificar:esquema` (scripts/verificarEsquema.ts, solo
// lectura contra Supabase). Pedido explícito tras el caso real de
// "gancho_tipo" (columna usada en el código antes de correr el SQL que
// la crea -- "No se pudo crear el reel" sin que el error real fuera
// obvio a simple vista).
//
// La comprobación de abajo (_mismasClaves) hace que el build falle si
// esta lista alguna vez se desincroniza de PublicacionOrganica -- ya
// sea por olvidar agregar un campo nuevo acá, o por escribir uno que no
// existe en la interfaz. Nunca confíes en actualizar esto a mano sin
// que `tsc` lo confirme.
export const COLUMNAS_PUBLICACIONES_ORGANICAS = [
  "id",
  "user_id",
  "plataforma",
  "receta_organica",
  "producto_id",
  "media_ids",
  "tema",
  "gancho_tipo",
  "guion",
  "caption",
  "hashtags",
  "programada_para",
  "estado",
  "generando_desde",
  "url_video",
  "cloudinary_public_id",
  "album_id",
  "ig_container_id",
  "ig_media_id",
  "permalink",
  "error",
  "tipo_error",
  "control_calidad",
  "intentos",
  "estado_antes_de_vencer",
  "semana",
  "continua_de_id",
  "creado_en",
  "actualizado_en",
] as const;

type _ClaveColumna = (typeof COLUMNAS_PUBLICACIONES_ORGANICAS)[number];
type _ClaveInterfaz = keyof PublicacionOrganica;
// Si falta o sobra una clave en cualquiera de los dos lados, esta línea
// deja de compilar (nunca se ejecuta, es solo una comprobación de tipos).
const _mismasClaves: [_ClaveColumna] extends [_ClaveInterfaz] ? ([_ClaveInterfaz] extends [_ClaveColumna] ? true : never) : never = true;
void _mismasClaves;

export const RECETAS_ORGANICAS_INFO: { id: RecetaOrganicaId; label: string; desc: string }[] = [
  { id: "consejos_numerados", label: "Consejos numerados", desc: "3 consejos útiles del rubro -- valor, no venta." },
  { id: "mito_verdad", label: "Mito o verdad", desc: "Desmentir 1 o 2 mitos del rubro." },
  { id: "producto_en_uso", label: "Producto en uso", desc: "El producto real resolviendo algo." },
  { id: "serie_partes", label: "Serie en partes", desc: '"Parte 1 de 3" -- la siguiente pieza retoma el tema.' },
  { id: "pregunta_comunidad", label: "Pregunta a la comunidad", desc: "Elige A o B, opina en los comentarios." },
  { id: "detras_de_marca", label: "Detrás de la marca", desc: "Valores, cómo se hace, por qué existe la marca." },
];

export function labelReceta(id: RecetaOrganicaId): string {
  return RECETAS_ORGANICAS_INFO.find((r) => r.id === id)?.label ?? id;
}

export const ESTADOS_INFO: Record<EstadoContenido, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "#999" },
  generando: { label: "Generando guion…", color: "#C8893F" },
  aprobada: { label: "Aprobada", color: "#2E9E6B" },
  renderizando: { label: "Renderizando…", color: "#534AB7" },
  lista: { label: "Lista para programar", color: "#2E9E6B" },
  publicando: { label: "Publicando…", color: "#534AB7" },
  procesando: { label: "Procesando en Instagram…", color: "#534AB7" },
  publicada: { label: "Publicada", color: "#2E9E6B" },
  error: { label: "Error", color: "#B91C1C" },
  vencida: { label: "Vencida", color: "#B91C1C" },
  cancelada: { label: "Cancelada", color: "#999" },
};

// Estados antes de tener video real -- si programada_para ya pasó y
// la pieza sigue en uno de estos, se marca "vencida" (ver GET
// /api/contenido). "error" queda afuera a propósito: ya tiene su
// propio motivo guardado (tipo_error), convertirlo a vencida lo
// perdería. "lista" también queda afuera: esa ya tiene video, su
// vencimiento lo maneja el RPC reclamar_publicaciones_organicas_vencidas
// (pasa a "publicando"), es un camino distinto.
export const ESTADOS_SIN_VIDEO_AUN: EstadoContenido[] = ["borrador", "generando", "aprobada", "renderizando"];

// Aviso "2h antes sin video" (commit 4d, pedido explícito): la pieza
// ya está aprobada (o renderizando) pero todavía no tiene el video
// real, y faltan 2h o menos para su hora -- distinto de "vencida"
// (esa ya pasó la hora). ahora como parámetro para poder probarlo con
// una fecha fija, igual que esFechaFutura.
export function piezaSinVideoProxima(pieza: Pick<PublicacionOrganica, "estado" | "programada_para">, ahora: Date = new Date()): boolean {
  if (pieza.estado !== "aprobada" && pieza.estado !== "renderizando") return false;
  const msRestantes = new Date(pieza.programada_para).getTime() - ahora.getTime();
  return msRestantes > 0 && msRestantes <= 2 * 60 * 60 * 1000;
}

// "La parte 1 promete una parte 2" (sección 2/9 del plan, pedido
// explícito de Juan José): antes esto se revisaba mal -- "continua_de_id"
// se guarda en la PARTE 2 apuntando a la parte 1, nunca al revés, así
// que mirar "!pieza.continua_de_id" en la propia pieza solo dice "esto
// no es ya una continuación", no "a esta le falta su continuación".
// La cuenta real: una pieza serie_partes que NO es continuación de
// otra (no tiene continua_de_id) "promete parte 2" sin cumplir si
// ninguna OTRA pieza de las que se están mirando ahora mismo
// (piezas, el calendario cargado) le apunta con su propio
// continua_de_id. Pura, se recalcula cada vez que cambia el
// calendario (aprobar, cancelar, borrar) -- no hace falta guardar nada.
export function idsQuePrometenParte2SinCumplir(piezas: Pick<PublicacionOrganica, "id" | "receta_organica" | "continua_de_id">[]): Set<string> {
  const idsConSecuela = new Set(piezas.filter((p) => p.continua_de_id).map((p) => p.continua_de_id as string));
  const resultado = new Set<string>();
  for (const p of piezas) {
    if (p.receta_organica === "serie_partes" && !p.continua_de_id && !idsConSecuela.has(p.id)) {
      resultado.add(p.id);
    }
  }
  return resultado;
}

// Pista de música para una pieza orgánica -- causa real de un reel
// publicado en silencio total (volumedetect: mean y max en -91dB):
// musica.pista_id quedaba SIEMPRE en null para contenido orgánico (a
// diferencia de /video, donde el admin la elige a mano), así que nunca
// había audio real que sonar, solo la pista AAC vacía que el
// codificador arma igual. Random entre las pistas activas CON LICENCIA
// (licencia_url no nulo, pedido explícito tras ese mismo arreglo: la
// asignación automática nunca puede usar una pista sin licencia, solo
// un admin eligiéndola a mano para pruebas), excluyendo "urgente" (ese
// mood es para venta directa, no para contenido de valor) -- si por
// algún motivo no hay ninguna con licencia fuera de "urgente", usa
// cualquiera con licencia antes que dejar la pieza en silencio. Si no
// hay NINGUNA pista con licencia, devuelve null a propósito -- sin
// música es mejor que una pista sin derechos saliendo publicada.
export function elegirPistaMusicalOrganica(pistasActivas: { id: string; mood: string; licencia_url: string | null }[]): string | null {
  const conLicencia = pistasActivas.filter((p) => !!p.licencia_url);
  if (conLicencia.length === 0) return null;
  const candidatas = conLicencia.filter((p) => p.mood !== "urgente");
  const pool = candidatas.length > 0 ? candidatas : conLicencia;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

// Tipo de gancho para la próxima pieza orgánica de una semana --
// rotación real, no al azar: cuenta cuántas veces aparece cada tipo en
// las piezas YA creadas esa semana (tiposYaUsados, incluye null/undefined
// de piezas sin asignar, se ignoran) y devuelve el que menos se repitió;
// empate se rompe por el orden fijo de GANCHO_TIPOS_ORGANICO, para que
// el resultado sea determinista. Pedido explícito: el tipo se decide al
// CREAR la pieza (no al generar el guion), para que nunca dependa de en
// qué orden se generen los guiones.
export function elegirGanchoTipoMenosUsado(tiposYaUsados: (string | null | undefined)[]): GanchoTipoOrganico {
  const conteo = new Map<GanchoTipoOrganico, number>();
  for (const t of GANCHO_TIPOS_ORGANICO) conteo.set(t, 0);
  for (const t of tiposYaUsados) {
    if (t && (GANCHO_TIPOS_ORGANICO as readonly string[]).includes(t)) {
      conteo.set(t as GanchoTipoOrganico, (conteo.get(t as GanchoTipoOrganico) ?? 0) + 1);
    }
  }
  let elegido: GanchoTipoOrganico = GANCHO_TIPOS_ORGANICO[0];
  let menorConteo = conteo.get(elegido)!;
  for (const t of GANCHO_TIPOS_ORGANICO) {
    const c = conteo.get(t)!;
    if (c < menorConteo) {
      elegido = t;
      menorConteo = c;
    }
  }
  return elegido;
}

// Una vez publicada (o publicándose) ya no se puede arrastrar a otro
// día en el calendario -- el recorrido con Instagram ya arrancó o
// terminó. Compartido entre la API (PATCH .../reprogramar) y la UI
// (decide si una tarjeta es draggable).
// Protección contra publicar piezas viejas (18 nov 2026, caso real: al
// encender el publicador en staging reclamó 2 piezas de prueba de hace
// 2-3 días que seguían en "lista"). Una pieza con más de este retraso
// NUNCA se publica sola: el Publicador la pasa a "vencida" con aviso y
// la opción "Publicar ahora". ÚNICO lugar de este valor -- la RPC
// reclamar_publicaciones_organicas_vencidas lo recibe como parámetro
// (p_retraso_maximo_minutos), no tiene su propia copia.
export const RETRASO_MAXIMO_PUBLICACION_HORAS = 2;
export const RETRASO_MAXIMO_PUBLICACION_MS = RETRASO_MAXIMO_PUBLICACION_HORAS * 60 * 60 * 1000;

// Una pieza en "error" de PUBLICACIÓN (token, Instagram rechazó el
// video, tiempo de procesamiento...) se puede reintentar: su video sigue
// ahí. Las de control de calidad ("calidad") tienen su propio camino
// ("Forzar de todos modos"). Revisión de punta a punta del publicador
// (18 nov 2026): antes una pieza en error no salía nunca de ese estado.
export function esErrorDePublicacionReintentable(pieza: Pick<PublicacionOrganica, "estado" | "tipo_error">): boolean {
  return pieza.estado === "error" && pieza.tipo_error !== "calidad";
}

// "Publicar ahora" / "Reintentar publicación" (piezas de Instagram con
// video, vencidas o con error de publicación): vuelve a "lista" con la
// hora actual, y el Publicador la toma en su siguiente vuelta con los
// mismos bloqueos de siempre.
export function puedePublicarAhora(pieza: Pick<PublicacionOrganica, "estado" | "url_video" | "plataforma"> & Partial<Pick<PublicacionOrganica, "tipo_error">>): boolean {
  if (!pieza.url_video || pieza.plataforma !== "instagram") return false;
  return pieza.estado === "vencida" || esErrorDePublicacionReintentable({ estado: pieza.estado, tipo_error: pieza.tipo_error ?? null });
}

// Campos que se limpian al volver a "lista" desde un error de
// publicación: el contenedor viejo de Instagram (ya inservible), el
// mensaje y los intentos pasajeros.
export const LIMPIEZA_TRAS_ERROR_PUBLICACION = { error: null, tipo_error: null, ig_container_id: null, intentos: 0 } as const;

// "cancelada" tampoco: una pieza eliminada no vuelve al calendario
// moviéndole la fecha (no aparece en él para poder arrastrarla, y la
// API lo rechaza igual).
export const ESTADOS_NO_REPROGRAMABLES: EstadoContenido[] = ["publicada", "publicando", "procesando", "cancelada"];

// Eliminar un reel (borrado suave: estado "cancelada", el video se queda
// en el álbum). Una sola fuente de verdad para la API y la pantalla.
export type EvaluacionEliminar =
  | { permitido: false; motivo: string }
  | { permitido: true; tipo: "eliminar" | "quitar_del_calendario" };

export function evaluarEliminacion(estado: EstadoContenido): EvaluacionEliminar {
  if (estado === "publicando" || estado === "procesando") return { permitido: false, motivo: "Se está publicando en este momento." };
  if (estado === "cancelada") return { permitido: false, motivo: "Este reel ya fue eliminado." };
  if (estado === "publicada") return { permitido: true, tipo: "quitar_del_calendario" };
  return { permitido: true, tipo: "eliminar" };
}

// Texto de la confirmación -- lo arma el servidor (sabe si hay una
// parte 2 aunque esté fuera de la semana/mes que se está mirando).
export function textosConfirmacionEliminar(params: {
  tipo: "eliminar" | "quitar_del_calendario";
  tieneParte2: boolean;
  publicacionSinConfirmar: boolean;
}): { titulo: string; detalles: string[]; boton: string } {
  const detalles: string[] = [];
  if (params.tipo === "quitar_del_calendario") {
    detalles.push("Ya está publicado: esto solo lo quita del calendario, no lo borra de Instagram.");
  }
  if (params.publicacionSinConfirmar) {
    detalles.push("No pudimos confirmar si este reel quedó publicado. Revisa tu Instagram: si salió, bórralo desde allá.");
  }
  if (params.tieneParte2) {
    detalles.push("Es la parte 1 de una serie: la parte 2 queda sin su anterior.");
  }
  if (params.tipo === "eliminar") detalles.push("El video se queda en tu álbum.");
  return params.tipo === "quitar_del_calendario"
    ? { titulo: "¿Quitar este reel del calendario?", detalles, boton: "Quitar del calendario" }
    : { titulo: "¿Eliminar este reel? No se publicará.", detalles, boton: "Eliminar" };
}

// A qué estado vuelve una pieza al reprogramarla. "vencida": con video
// vuelve a "lista" (conserva su control de calidad y su "Publicar de
// todos modos"); sin video vuelve a "aprobada" solo si ya lo estaba antes
// de vencerse -- si no, a "borrador", para que nunca se salte la
// aprobación de un humano. "error" de publicación: con video vuelve a
// "lista" (reintento); sin video, a "aprobada" (falta renderizarla).
export function estadoAlReprogramar(pieza: Pick<PublicacionOrganica, "estado" | "url_video" | "estado_antes_de_vencer"> & Partial<Pick<PublicacionOrganica, "tipo_error">>): EstadoContenido {
  if (pieza.estado === "error" && esErrorDePublicacionReintentable({ estado: pieza.estado, tipo_error: pieza.tipo_error ?? null })) {
    return pieza.url_video ? "lista" : "aprobada";
  }
  if (pieza.estado !== "vencida") return pieza.estado;
  if (pieza.url_video) return "lista";
  if (pieza.estado_antes_de_vencer === "aprobada" || pieza.estado_antes_de_vencer === "renderizando") return "aprobada";
  return "borrador";
}

// Punto de color del calendario (rediseño estilo Meta Business Suite/
// Metricool, sección 2 del plan) -- agrupa por progreso, no 1 color
// por estado como ESTADOS_INFO.color: gris=sin arrancar,
// amarillo=trabajando, azul=listo para publicar, verde=publicada,
// rojo=necesita atención. Deliberadamente distinto de ESTADOS_INFO
// (que sigue siendo 1 color por estado, para textos/badges).
export function colorPuntoEstado(estado: EstadoContenido): string {
  if (estado === "borrador" || estado === "generando" || estado === "cancelada") return "#999";
  if (estado === "aprobada" || estado === "renderizando" || estado === "publicando" || estado === "procesando") return "#D9A82B";
  if (estado === "lista") return "#2F6FE4";
  if (estado === "publicada") return "#2E9E6B";
  return "#B91C1C"; // error, vencida
}

// Lunes de la semana (Bogotá) que contiene fechaYMD -- mismo criterio
// que diasEntre()/hoyBogota(): todo en fechas de calendario, sin tocar
// la hora salvo para calcular el día de la semana real.
export function lunesDeLaSemana(fechaYMD: string): string {
  const fecha = inicioDiaBogota(fechaYMD);
  // getUTCDay(): 0=domingo..6=sábado -- inicioDiaBogota ya fija la hora
  // en el offset de Bogotá, así que el día de la semana en UTC de ese
  // instante es el día real en Bogotá.
  const diaSemana = fecha.getUTCDay();
  const diasHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunes = new Date(fecha.getTime() - diasHastaLunes * 24 * 60 * 60 * 1000);
  return fechaBogota(lunes);
}

// Recetas que no se pueden elegir sin al menos una foto/video del
// álbum (commit 4b.2, pedido explícito: "producto_en_uso exige al
// menos una pieza; si no hay, no se puede elegir esa receta").
export const RECETAS_QUE_EXIGEN_MEDIA: RecetaOrganicaId[] = ["producto_en_uso"];

// "programada_para" nunca puede quedar en el pasado -- ni fecha ni
// hora (pedido explícito tras un caso real: una pieza quedó programada
// para un día que ya había pasado). Comparación por instante real
// (epoch), no por fecha de calendario -- "hoy pero hace 2 horas"
// también debe rechazarse. Se usa tanto al crear como al reprogramar
// (PATCH, sección 2 del calendario).
export function esFechaFutura(iso: string): boolean {
  const fecha = new Date(iso);
  return !Number.isNaN(fecha.getTime()) && fecha.getTime() > Date.now();
}

export const CrearPiezaManualSchema = z
  .object({
    receta_organica: z.enum(RECETAS_ORGANICAS_IDS),
    // offset: true acepta tanto "...Z" como "...-05:00" -- el navegador
    // manda la hora local de la marca con su propio offset, nunca UTC a mano.
    programada_para: z.iso.datetime({ offset: true }),
    producto_id: z.uuid().optional().nullable(),
    media_ids: z.array(z.uuid()).max(3).optional(),
    // "Tu idea para el video": un tema corto o la idea completa del usuario.
    tema: z.string().trim().max(LIMITE_IDEA).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (RECETAS_QUE_EXIGEN_MEDIA.includes(v.receta_organica) && (v.media_ids?.length ?? 0) === 0) {
      ctx.addIssue({ code: "custom", message: "Esta receta exige al menos una foto o video del álbum.", path: ["media_ids"] });
    }
    if (!esFechaFutura(v.programada_para)) {
      ctx.addIssue({ code: "custom", message: "La fecha y hora deben ser futuras.", path: ["programada_para"] });
    }
  });

// "dom 9 nov · 12:00 p. m." -- formato largo pedido explícitamente.
// Intl ya da "lun, 9 de nov" (con coma y "de") y "12:00 p. m." por
// separado -- se toman los tres valores sueltos (weekday/day/month) de
// formatToParts y se arma el molde a mano, en vez de pelear con las
// opciones de Intl para sacarle la coma y el "de". Siempre en hora de
// Bogotá, igual que el resto de video/ y app/lib/fechaBogota.ts.
export function formatoFechaLarga(iso: string): string {
  const fecha = new Date(iso);
  const partesFecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric", month: "short" }).formatToParts(fecha);
  const obtener = (tipo: string) => partesFecha.find((p) => p.type === tipo)?.value ?? "";
  const hora = fecha.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", hour12: true });
  return `${obtener("weekday")} ${obtener("day")} ${obtener("month")} · ${hora}`;
}
