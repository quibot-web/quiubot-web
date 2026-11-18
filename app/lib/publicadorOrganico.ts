import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { ESTADOS_SIN_VIDEO_AUN, type PublicacionOrganica } from "@/app/lib/contenido";
import { urlVideoCompatible } from "@/app/lib/cloudinaryUrl";
import {
  resolverCuentaInstagramParaPublicar,
  consultarCupoInstagram,
  crearContenedorInstagram,
  verificarEstadoContenedorInstagram,
  publicarContenedorInstagram,
  type ErrorPublicarInstagram,
} from "@/app/lib/instagramPublicar";
import { textoReelPublicado, textoReelPublicacionError, textoReelVencido } from "@/app/lib/director/textosEquipo";
import type { MensajeEquipoContenido, TipoEventoEquipo } from "@/app/lib/director/mensajeEquipo.schema";

// Publicador automático de contenido orgánico (paso 4 de la
// integración de Fase B v2.0, docs/diseno/plan_contenido_organico.md
// sección 7). Lo corre POST /api/cron/publicar-organico cada 5 min.
// Cada vuelta, en este orden:
//   1. Rescate de atascadas (30 min, sin reintento en publicando/procesando).
//   2. Vencer piezas que llegaron a su hora sin video.
//   3. Avisar (una sola vez) las "lista" vencidas que NO se pueden
//      publicar solas (QC forzado sin confirmar, música sin licencia).
//   4. Contenedores en "procesando": FINISHED → media_publish.
//   5. Reclamar "lista" vencidas (RPC atómica) → cupo → contenedor REELS.
// El polling de Meta vive entre vueltas (paso 4 de la siguiente
// corrida), nunca dentro de una misma petición: un reel puede tardar
// minutos en procesarse y el proxy de Coolify cortaría la conexión.

export const TIMEOUT_ATASCADO_MS = 30 * 60 * 1000;
export const LIMITE_POR_CORRIDA = 10;
// Errores pasajeros al CREAR el contenedor (red, 5xx, límite de tasa):
// ahí todavía no hay nada publicado, así que es seguro devolver la pieza
// a "lista" y reintentar en la siguiente vuelta. Se cuenta en la misma
// columna "intentos" que usa la subida del video (video-listo), así que
// en la práctica son 2-3 intentos, nunca más de 3 en total.
export const MAX_INTENTOS_TRANSITORIOS = 3;
const ANCHO_VIDEO_INSTAGRAM = 1080;

const MENSAJE_REVISAR_PUBLICACION = "No pudimos confirmar si el reel se publicó. Revisa tu Instagram antes de volver a programarlo.";
const MENSAJE_RECHAZO_META = "Instagram no aceptó el video. Revísalo antes de volver a programarlo.";

type PiezaPublicador = Pick<
  PublicacionOrganica,
  "id" | "user_id" | "plataforma" | "guion" | "caption" | "hashtags" | "url_video" | "control_calidad" | "ig_container_id" | "intentos" | "programada_para"
>;

type UsuarioMeta = { id: string; email: string | null; meta_page_id: string | null; meta_access_token: string | null };

export type MotivoBloqueo = "no_es_instagram" | "requiere_confirmacion" | "musica_sin_licencia";

// Misma regla que la RPC reclamar_publicaciones_organicas_vencidas
// (docs/sql/contenido_organico_publicador.sql) -- repetida acá como
// segunda barrera: si la base todavía tuviera la versión vieja de la
// RPC (sin estos filtros), el cron igual nunca publica una de estas.
// Igual de estricta que el SQL con valores raros: solo cuentan los
// booleanos reales (aprobado/publicarIgual), y un pista_id que no sea
// uuid es "música no verificable" -- nunca se publica, nunca revienta.
export function motivoBloqueoPublicacion(
  pieza: Pick<PublicacionOrganica, "plataforma" | "control_calidad" | "guion">,
  pistasConLicenciaInstagram: Set<string>
): MotivoBloqueo | null {
  if (pieza.plataforma !== "instagram") return "no_es_instagram";
  if (!controlCalidadPermitePublicar(pieza.control_calidad)) return "requiere_confirmacion";
  const pistaId = pistaIdDeGuion(pieza.guion);
  if (pistaId !== null && (!esUuid(pistaId) || !pistasConLicenciaInstagram.has(pistaId.toLowerCase()))) return "musica_sin_licencia";
  return null;
}

function controlCalidadPermitePublicar(qc: unknown): boolean {
  if (qc === null || qc === undefined) return true;
  if (typeof qc !== "object" || Array.isArray(qc)) return false;
  const { aprobado, publicarIgual } = qc as { aprobado?: unknown; publicarIgual?: unknown };
  if (!("aprobado" in qc)) return true;
  if (aprobado === true) return true;
  return aprobado === false && publicarIgual === true;
}

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function esUuid(valor: string): boolean {
  return PATRON_UUID.test(valor);
}

// null = sin música (ausente, null o ""). Cualquier otro valor se
// devuelve como texto tal cual -- si no es un uuid de una pista con
// licencia, motivoBloqueoPublicacion bloquea la pieza.
export function pistaIdDeGuion(guion: unknown): string | null {
  if (!guion || typeof guion !== "object") return null;
  const musica = (guion as { musica?: unknown }).musica;
  if (!musica || typeof musica !== "object") return null;
  const pistaId = (musica as { pista_id?: unknown }).pista_id;
  if (pistaId === null || pistaId === undefined || pistaId === "") return null;
  return String(pistaId);
}

// Caption final de Instagram: texto + hashtags (con "#" siempre), dentro
// del límite de 2.200 caracteres de Instagram.
export function captionParaInstagram(caption: string | null, hashtags: string[] | null): string {
  const tags = (hashtags ?? [])
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const texto = [caption?.trim() ?? "", tags].filter(Boolean).join("\n\n");
  return texto.slice(0, 2200);
}

async function cargarPistasConLicenciaInstagram(piezas: Pick<PublicacionOrganica, "guion">[]): Promise<Set<string>> {
  // Solo uuids válidos llegan a la consulta: uno inválido haría fallar
  // la consulta entera y bloquearía también la música de las demás.
  const ids = [
    ...new Set(
      piezas
        .map((p) => pistaIdDeGuion(p.guion))
        .filter((id): id is string => id !== null && esUuid(id))
        .map((id) => id.toLowerCase())
    ),
  ];
  if (ids.length === 0) return new Set();
  const { data } = await supabaseAdmin.from("pistas_musicales").select("id, licencia_url, plataformas_permitidas").in("id", ids);
  return new Set(
    (data ?? [])
      .filter((p) => !!p.licencia_url && Array.isArray(p.plataformas_permitidas) && (p.plataformas_permitidas as string[]).includes("instagram"))
      .map((p) => String(p.id).toLowerCase())
  );
}

// Mensaje del asistente Publicador en el chat del Equipo -- una sola vez
// por (pieza, evento): se revisa antes de insertar (no se depende solo
// del índice único, para que el aviso de "lista bloqueada", que se
// recalcula cada 5 min, nunca se repita).
export async function avisarPublicador(params: { userId: string; piezaId: string; tipoEvento: TipoEventoEquipo; contenido: MensajeEquipoContenido; sufijo?: string }) {
  const origenId = `po:${params.piezaId}:${params.sufijo ?? params.tipoEvento}`;
  try {
    const { data: existente } = await supabaseAdmin
      .from("mensajes_equipo")
      .select("id")
      .eq("user_id", params.userId)
      .eq("tipo_evento", params.tipoEvento)
      .eq("origen_id", origenId)
      .limit(1);
    if (existente && existente.length > 0) return;
    const { error } = await supabaseAdmin.from("mensajes_equipo").insert({
      user_id: params.userId,
      asistente: "publicador",
      tipo_evento: params.tipoEvento,
      contenido: params.contenido,
      origen_id: origenId,
    });
    if (error && error.code !== "23505") console.error(`Error insertando ${params.tipoEvento} en mensajes_equipo:`, error);
  } catch (err) {
    console.error("Error avisando en el chat del Equipo:", err);
  }
}

async function cargarUsuarios(ids: string[]): Promise<Map<string, UsuarioMeta>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from("usuarios").select("id, email, meta_page_id, meta_access_token").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((u) => [u.id as string, u as UsuarioMeta]));
}

// La cuenta de Instagram se resuelve en vivo (no hay columna guardada),
// una sola vez por usuario por corrida.
function crearResolverInstagram() {
  const cache = new Map<string, Promise<{ igUserId: string } | ErrorPublicarInstagram>>();
  return (usuario: UsuarioMeta) => {
    if (!usuario.meta_page_id || !usuario.meta_access_token) {
      return Promise.resolve<ErrorPublicarInstagram>({ error: "Meta no está conectado.", tipo: "reconexion" });
    }
    let p = cache.get(usuario.id);
    if (!p) {
      p = resolverCuentaInstagramParaPublicar(usuario.meta_page_id, usuario.meta_access_token);
      cache.set(usuario.id, p);
    }
    return p;
  };
}

function tipoErrorDePieza(tipo: ErrorPublicarInstagram["tipo"]): string {
  if (tipo === "reconexion" || tipo === "permiso") return "reconexion";
  if (tipo === "sin_instagram") return "sin_instagram";
  return "meta_rechazo";
}

function motivoMensaje(tipoErrorPieza: string): "reconexion" | "revisar" | "otro" {
  if (tipoErrorPieza === "reconexion" || tipoErrorPieza === "sin_instagram") return "reconexion";
  if (tipoErrorPieza === "revisar_publicacion") return "revisar";
  return "otro";
}

// Pasa la pieza a "error" solo si sigue en el estado esperado (nunca
// pisa algo que otra vuelta ya cambió), avisa en el chat y registra el
// error real para /admin/errores -- el usuario solo ve el texto amable.
async function marcarError(params: {
  pieza: Pick<PiezaPublicador, "id" | "user_id">;
  estadoEsperado: string;
  tipoError: string;
  mensaje: string;
  email: string | null;
  paso: string;
  detalle?: string | null;
}): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("publicaciones_organicas")
    .update({ estado: "error", tipo_error: params.tipoError, error: params.mensaje, actualizado_en: new Date().toISOString() })
    .eq("id", params.pieza.id)
    .eq("estado", params.estadoEsperado)
    .select("id");
  if (!data || data.length === 0) return false;

  await registrarError({
    origen: "publicador_organico",
    userId: params.pieza.user_id,
    email: params.email,
    paso: params.paso,
    errorMensaje: params.mensaje,
    detalleTecnico: params.detalle ?? params.tipoError,
  });
  await avisarPublicador({
    userId: params.pieza.user_id,
    piezaId: params.pieza.id,
    tipoEvento: "reel_publicacion_error",
    contenido: textoReelPublicacionError({ motivo: motivoMensaje(params.tipoError) }),
  });
  return true;
}

// 1. Rescate de atascadas. renderizando → aprobada (todavía no hay nada
// en Instagram, es seguro volver a intentar). publicando/procesando →
// error "revisar_publicacion", SIN reintento: Instagram pudo haberlo
// publicado o no, reintentar a ciegas podría publicarlo dos veces.
// Ojo: el polling de "procesando" nunca toca actualizado_en, así que
// estos 30 min se cuentan desde que se creó el contenedor.
export async function rescatarAtascadas(ahora = new Date()): Promise<{ renderizandoDevueltas: number; publicacionesARevisar: number }> {
  const limite = new Date(ahora.getTime() - TIMEOUT_ATASCADO_MS).toISOString();

  const { data: devueltas } = await supabaseAdmin
    .from("publicaciones_organicas")
    .update({ estado: "aprobada", actualizado_en: ahora.toISOString() })
    .eq("estado", "renderizando")
    .lt("actualizado_en", limite)
    .select("id");

  const { data: atascadas } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id, user_id, estado")
    .in("estado", ["publicando", "procesando"])
    .lt("actualizado_en", limite);

  const usuarios = await cargarUsuarios((atascadas ?? []).map((p) => p.user_id as string));
  let aRevisar = 0;
  for (const pieza of atascadas ?? []) {
    const marcada = await marcarError({
      pieza: { id: pieza.id as string, user_id: pieza.user_id as string },
      estadoEsperado: pieza.estado as string,
      tipoError: "revisar_publicacion",
      mensaje: MENSAJE_REVISAR_PUBLICACION,
      email: usuarios.get(pieza.user_id as string)?.email ?? null,
      paso: `atascada_en_${pieza.estado}`,
    });
    if (marcada) aRevisar++;
  }

  return { renderizandoDevueltas: devueltas?.length ?? 0, publicacionesARevisar: aRevisar };
}

// 2. Piezas que llegaron a su hora sin video real → "vencida" + aviso.
// Mismo criterio que ya aplicaba GET /api/contenido al cargar el
// calendario (ESTADOS_SIN_VIDEO_AUN) -- ahora también lo usa esa ruta,
// para que el aviso salga sin importar quién lo vea primero.
export async function vencerPiezasSinVideo(params: { userId?: string; ahora?: Date } = {}): Promise<number> {
  const ahora = params.ahora ?? new Date();
  const vencidas: { id: string; user_id: string }[] = [];
  // Un update por estado de origen: así cada fila guarda en
  // estado_antes_de_vencer el estado real que tenía (supabase-js no
  // puede copiar una columna en otra dentro de un mismo update).
  for (const estadoPrevio of ESTADOS_SIN_VIDEO_AUN) {
    let consulta = supabaseAdmin
      .from("publicaciones_organicas")
      .update({ estado: "vencida", estado_antes_de_vencer: estadoPrevio, actualizado_en: ahora.toISOString() })
      .eq("estado", estadoPrevio)
      .lt("programada_para", ahora.toISOString());
    if (params.userId) consulta = consulta.eq("user_id", params.userId);
    const { data, error } = await consulta.select("id, user_id");
    if (error) {
      console.error(`No se pudieron vencer piezas en "${estadoPrevio}":`, error);
      continue;
    }
    vencidas.push(...((data ?? []) as { id: string; user_id: string }[]));
  }
  for (const pieza of vencidas) {
    await avisarPublicador({
      userId: pieza.user_id,
      piezaId: pieza.id,
      tipoEvento: "reel_vencido",
      contenido: textoReelVencido({ motivo: "sin_video" }),
      sufijo: "sin_video",
    });
  }
  return vencidas.length;
}

// 3. "lista" ya vencidas que el Publicador NO puede tomar -- se quedan
// en "lista" (apenas se confirme o se cambie la música, la siguiente
// vuelta la publica), pero el usuario se entera una sola vez.
export async function avisarListasBloqueadas(ahora = new Date()): Promise<number> {
  const { data } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id, user_id, plataforma, guion, control_calidad")
    .eq("estado", "lista")
    .eq("plataforma", "instagram")
    .lte("programada_para", ahora.toISOString())
    .limit(50);
  const piezas = (data ?? []) as Pick<PublicacionOrganica, "id" | "user_id" | "plataforma" | "guion" | "control_calidad">[];
  const pistas = await cargarPistasConLicenciaInstagram(piezas);
  let avisadas = 0;
  for (const pieza of piezas) {
    const motivo = motivoBloqueoPublicacion(pieza, pistas);
    if (motivo !== "requiere_confirmacion" && motivo !== "musica_sin_licencia") continue;
    await avisarPublicador({ userId: pieza.user_id, piezaId: pieza.id, tipoEvento: "reel_vencido", contenido: textoReelVencido({ motivo }), sufijo: motivo });
    avisadas++;
  }
  return avisadas;
}

// 4. Contenedores ya creados: FINISHED → media_publish. Antes de
// publicar se reclama procesando→publicando (atómico), para que dos
// vueltas solapadas nunca llamen media_publish dos veces.
export async function procesarContenedores(): Promise<{ publicadas: number; conError: number; esperando: number }> {
  const { data } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id, user_id, ig_container_id")
    .eq("estado", "procesando")
    .not("ig_container_id", "is", null)
    .order("programada_para", { ascending: true })
    .limit(LIMITE_POR_CORRIDA);
  const piezas = (data ?? []) as Pick<PiezaPublicador, "id" | "user_id" | "ig_container_id">[];
  const usuarios = await cargarUsuarios(piezas.map((p) => p.user_id));
  const resolverIg = crearResolverInstagram();
  const resumen = { publicadas: 0, conError: 0, esperando: 0 };

  for (const pieza of piezas) {
    const usuario = usuarios.get(pieza.user_id);
    const email = usuario?.email ?? null;
    if (!usuario?.meta_access_token) {
      if (await marcarError({ pieza, estadoEsperado: "procesando", tipoError: "reconexion", mensaje: "Conecta tu cuenta de Meta para publicar.", email, paso: "procesando_sin_token" })) resumen.conError++;
      continue;
    }

    const estado = await verificarEstadoContenedorInstagram({ accessToken: usuario.meta_access_token, containerId: pieza.ig_container_id as string });
    if ("error" in estado) {
      if (estado.tipo === "reconexion" || estado.tipo === "permiso") {
        if (await marcarError({ pieza, estadoEsperado: "procesando", tipoError: "reconexion", mensaje: estado.error, email, paso: "verificar_contenedor", detalle: estado.detalle })) resumen.conError++;
      } else {
        // Pasajero: se vuelve a mirar en la siguiente vuelta (el rescate
        // de 30 min lo corta si nunca se resuelve).
        resumen.esperando++;
      }
      continue;
    }

    if (estado.status_code === "ERROR" || estado.status_code === "EXPIRED") {
      if (await marcarError({ pieza, estadoEsperado: "procesando", tipoError: "meta_rechazo", mensaje: MENSAJE_RECHAZO_META, email, paso: "contenedor_" + estado.status_code.toLowerCase() })) resumen.conError++;
      continue;
    }
    if (estado.status_code === "PUBLISHED") {
      // Meta dice que este contenedor ya se publicó, pero no lo
      // registramos nosotros -- nunca se publica otra vez.
      if (await marcarError({ pieza, estadoEsperado: "procesando", tipoError: "revisar_publicacion", mensaje: MENSAJE_REVISAR_PUBLICACION, email, paso: "contenedor_ya_publicado" })) resumen.conError++;
      continue;
    }
    if (estado.status_code !== "FINISHED") {
      resumen.esperando++;
      continue;
    }

    const { data: reclamada } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ estado: "publicando", actualizado_en: new Date().toISOString() })
      .eq("id", pieza.id)
      .eq("estado", "procesando")
      .select("id");
    if (!reclamada || reclamada.length === 0) continue;

    const ig = await resolverIg(usuario);
    if ("error" in ig) {
      const tipoError = tipoErrorDePieza(ig.tipo);
      if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError, mensaje: ig.error, email, paso: "resolver_instagram_publicar" })) resumen.conError++;
      continue;
    }

    const publicado = await publicarContenedorInstagram({ accessToken: usuario.meta_access_token, igUserId: ig.igUserId, containerId: pieza.ig_container_id as string });
    if ("error" in publicado) {
      // Sin reintento: una falla de red en media_publish puede haber
      // publicado igual. Solo token/permiso se distingue (pide reconectar).
      const tipoError = publicado.tipo === "reconexion" || publicado.tipo === "permiso" ? "reconexion" : "revisar_publicacion";
      const mensaje = tipoError === "reconexion" ? publicado.error : MENSAJE_REVISAR_PUBLICACION;
      if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError, mensaje, email, paso: "media_publish", detalle: publicado.detalle })) resumen.conError++;
      continue;
    }

    const { error: errorGuardar } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({
        estado: "publicada",
        ig_media_id: publicado.media_id,
        permalink: publicado.permalink ?? null,
        error: null,
        tipo_error: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", pieza.id)
      .eq("estado", "publicando");
    if (errorGuardar) {
      // Publicado de verdad, pero no quedó guardado: la pieza sigue en
      // "publicando" y el rescate de 30 min la manda a "revisar", nunca
      // a un reintento.
      await registrarError({
        origen: "publicador_organico",
        userId: pieza.user_id,
        email,
        paso: "guardar_publicada",
        errorMensaje: "El reel se publicó pero no se pudo guardar el resultado.",
        detalleTecnico: `${errorGuardar.message} (ig_media_id=${publicado.media_id})`,
      });
      continue;
    }

    resumen.publicadas++;
    await avisarPublicador({ userId: pieza.user_id, piezaId: pieza.id, tipoEvento: "reel_publicado", contenido: textoReelPublicado({ permalink: publicado.permalink ?? null }) });
  }

  return resumen;
}

// Devuelve la pieza a "lista" sin tocar nada más (no hubo contenedor,
// así que es seguro). intentos solo se suma en errores pasajeros.
async function devolverALista(piezaId: string, intentos?: number) {
  await supabaseAdmin
    .from("publicaciones_organicas")
    .update({ estado: "lista", ...(intentos !== undefined ? { intentos } : {}), actualizado_en: new Date().toISOString() })
    .eq("id", piezaId)
    .eq("estado", "publicando");
}

// 5. Reclamar "lista" vencidas con la RPC atómica (FOR UPDATE SKIP
// LOCKED, nunca la misma pieza en dos vueltas) → cupo → contenedor REELS.
export async function reclamarYCrearContenedores(): Promise<{ reclamadas: number; contenedores: number; devueltas: number; conError: number; sinCupo: number }> {
  const resumen = { reclamadas: 0, contenedores: 0, devueltas: 0, conError: 0, sinCupo: 0 };
  const { data, error } = await supabaseAdmin.rpc("reclamar_publicaciones_organicas_vencidas", { p_limite: LIMITE_POR_CORRIDA });
  if (error) {
    console.error("Error reclamando piezas para publicar:", error);
    await registrarError({ origen: "publicador_organico", email: null, paso: "rpc_reclamar", errorMensaje: "No se pudieron reclamar piezas para publicar.", detalleTecnico: error.message });
    return resumen;
  }
  const piezas = (data ?? []) as PiezaPublicador[];
  resumen.reclamadas = piezas.length;
  if (piezas.length === 0) return resumen;

  const pistas = await cargarPistasConLicenciaInstagram(piezas);
  const usuarios = await cargarUsuarios(piezas.map((p) => p.user_id));
  const resolverIg = crearResolverInstagram();
  const cupoPorIg = new Map<string, { restantes: number } | null>();

  for (const pieza of piezas) {
    const usuario = usuarios.get(pieza.user_id);
    const email = usuario?.email ?? null;

    // Segunda barrera (ver motivoBloqueoPublicacion).
    if (motivoBloqueoPublicacion(pieza, pistas)) {
      await devolverALista(pieza.id);
      resumen.devueltas++;
      continue;
    }
    if (!pieza.url_video) {
      if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError: "sin_video", mensaje: "La pieza no tiene video para publicar.", email, paso: "sin_url_video" })) resumen.conError++;
      continue;
    }
    if (!usuario?.meta_page_id || !usuario.meta_access_token) {
      if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError: "reconexion", mensaje: "Conecta tu cuenta de Meta para publicar en Instagram.", email, paso: "sin_meta" })) resumen.conError++;
      continue;
    }

    const ig = await resolverIg(usuario);
    if ("error" in ig) {
      if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError: tipoErrorDePieza(ig.tipo), mensaje: ig.error, email, paso: "resolver_instagram" })) resumen.conError++;
      continue;
    }

    // Cupo (content_publishing_limit), una consulta por cuenta por
    // vuelta; se descuenta localmente por cada contenedor creado.
    if (!cupoPorIg.has(ig.igUserId)) {
      const cupo = await consultarCupoInstagram({ igUserId: ig.igUserId, accessToken: usuario.meta_access_token });
      if (cupo && "tokenVencido" in cupo) {
        if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError: "reconexion", mensaje: "Tu conexión con Meta venció. Reconéctala para seguir publicando.", email, paso: "cupo_token" })) resumen.conError++;
        continue;
      }
      cupoPorIg.set(ig.igUserId, cupo ? { restantes: cupo.total - cupo.usado } : null);
    }
    const cupo = cupoPorIg.get(ig.igUserId);
    if (cupo && cupo.restantes <= 0) {
      // Sin cupo hoy: vuelve a "lista" sin gastar intentos -- se
      // publica sola cuando la ventana de 24h libere espacio.
      await devolverALista(pieza.id);
      resumen.sinCupo++;
      continue;
    }

    const contenedor = await crearContenedorInstagram({
      igUserId: ig.igUserId,
      accessToken: usuario.meta_access_token,
      videoUrl: urlVideoCompatible(pieza.url_video, ANCHO_VIDEO_INSTAGRAM),
      caption: captionParaInstagram(pieza.caption, pieza.hashtags),
      omitirRevisionCupo: true,
    });

    if ("error" in contenedor) {
      if (contenedor.tipo === "transitorio" || contenedor.tipo === "cupo") {
        const intentos = (pieza.intentos ?? 0) + 1;
        if (contenedor.tipo === "transitorio" && intentos >= MAX_INTENTOS_TRANSITORIOS) {
          if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError: "meta_rechazo", mensaje: "Instagram no respondió después de varios intentos.", email, paso: "crear_contenedor_reintentos", detalle: contenedor.detalle })) resumen.conError++;
        } else {
          await devolverALista(pieza.id, contenedor.tipo === "transitorio" ? intentos : undefined);
          resumen.devueltas++;
        }
        continue;
      }
      const tipoError = tipoErrorDePieza(contenedor.tipo);
      const mensaje = tipoError === "reconexion" ? contenedor.error : MENSAJE_RECHAZO_META;
      if (await marcarError({ pieza, estadoEsperado: "publicando", tipoError, mensaje, email, paso: "crear_contenedor", detalle: contenedor.detalle })) resumen.conError++;
      continue;
    }

    if (cupo) cupo.restantes--;
    const { error: errorGuardar } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ estado: "procesando", ig_container_id: contenedor.container_id, actualizado_en: new Date().toISOString() })
      .eq("id", pieza.id)
      .eq("estado", "publicando");
    if (errorGuardar) {
      // El contenedor existe pero no quedó guardado: nunca se publica
      // (vence solo en 24h). La pieza sigue en "publicando" y el rescate
      // la manda a revisar.
      await registrarError({
        origen: "publicador_organico",
        userId: pieza.user_id,
        email,
        paso: "guardar_contenedor",
        errorMensaje: "No se pudo guardar el contenedor de Instagram.",
        detalleTecnico: `${errorGuardar.message} (container=${contenedor.container_id})`,
      });
      continue;
    }
    resumen.contenedores++;
  }

  return resumen;
}

export async function ejecutarPublicadorOrganico() {
  const ahora = new Date();
  const rescate = await rescatarAtascadas(ahora);
  const vencidas = await vencerPiezasSinVideo({ ahora });
  const bloqueadasAvisadas = await avisarListasBloqueadas(ahora);
  const procesamiento = await procesarContenedores();
  const reclamo = await reclamarYCrearContenedores();
  return { rescate, vencidas, bloqueadasAvisadas, procesamiento, reclamo };
}
