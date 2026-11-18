import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { GuionSchema, type Guion } from "@/video/guion.schema";
import {
  ESTADOS_NO_REPROGRAMABLES,
  esFechaFutura,
  lunesDeLaSemana,
  evaluarEliminacion,
  textosConfirmacionEliminar,
  estadoAlReprogramar,
  type EstadoContenido,
  type PublicacionOrganica,
} from "@/app/lib/contenido";
import { fechaBogota } from "@/app/lib/fechaBogota";
import { infoAdicionalEsSuficiente } from "@/video/promptGuionOrganico";
import { urlPistaMusical } from "@/app/lib/cloudinaryUrl";
import { vozDesactualizada } from "@/app/lib/videoOrganico/hashNarracion";
import { regenerarVozParaGuion } from "@/app/lib/videoOrganico/generarGuionConVoz";

const VOZ_POR_DEFECTO = "cedar";

// Detalle de una pieza (commit 4b, pantalla de revisión) + "Aprobar".
// Solo admin, igual que el resto del plan.

async function usuarioAdminOFalla(email: string) {
  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id, rol").eq("email", email).single();
  if (!usuario) return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) };
  if (usuario.rol !== "admin") return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  return { usuario };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { usuario, error } = await usuarioAdminOFalla(emailBusqueda);
  if (error) return error;

  const { data: pieza } = await supabaseAdmin.from("publicaciones_organicas").select("*").eq("id", id).eq("user_id", usuario!.id).maybeSingle();

  if (!pieza) {
    return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  }

  // Resuelve las piezas del álbum elegidas (commit 4b.2), para que la
  // revisión pueda mostrar el video/foto real en el player y en el
  // editor -- mismo contrato {url, tipo} que medios en video/guion.schema.ts.
  const mediaIds: string[] = Array.isArray(pieza.media_ids) ? pieza.media_ids : [];
  const medios: Record<string, { url: string; tipo: "imagen" | "video" }> = {};
  if (mediaIds.length > 0) {
    const { data: piezasAlbum } = await supabaseAdmin.from("album_creativos").select("id, url_imagen, tipo").eq("user_id", usuario!.id).in("id", mediaIds);
    for (const p of piezasAlbum ?? []) {
      medios[p.id] = { url: p.url_imagen, tipo: p.tipo === "video" ? "video" : "imagen" };
    }
  }

  // Aviso de contenido pobre (pedido explícito, revisión de calidad):
  // si la marca no tiene "Lo que deben saber" lleno, el guion se puede
  // generar igual con solo el catálogo, pero la revisión avisa que el
  // contenido sería mejor con ese dato -- se recalcula en vivo en cada
  // GET (no queda pegado a un guion viejo), así que si luego lo
  // completan en Mi marca, el aviso desaparece solo.
  const { data: marcaInfo } = await supabaseAdmin.from("marcas").select("info_adicional").eq("email", emailBusqueda).maybeSingle();
  const avisoInfoIncompleta = !infoAdicionalEsSuficiente((marcaInfo?.info_adicional as string | null) ?? null);

  // Resuelve la pista de música real (mismo patrón que video/render.ts
  // para anuncios) -- causa real de un reel publicado en silencio
  // total: ColaDeRender.tsx mandaba pistaUrl:null siempre, sin importar
  // qué pista_id tuviera el guion. pistaSinLicencia: solo puede pasar
  // si un admin la eligió a mano (la asignación automática ya nunca
  // elige una sin licencia, ver elegirPistaMusicalOrganica) -- la
  // revisión muestra "Solo pruebas, no publicar" cuando esto es true.
  let pistaUrl: string | null = null;
  let pistaSinLicencia = false;
  const pistaId = (pieza.guion as { musica?: { pista_id?: string | null } } | null)?.musica?.pista_id;
  if (pistaId) {
    const { data: pista } = await supabaseAdmin.from("pistas_musicales").select("public_id, cloudinary_name, licencia_url").eq("id", pistaId).maybeSingle();
    if (pista) {
      pistaUrl = urlPistaMusical(pista.cloudinary_name, pista.public_id);
      pistaSinLicencia = !pista.licencia_url;
    }
  }

  // Aviso "sin música" (pedido explícito): solo si de verdad no hay
  // NINGUNA pista con licencia en la biblioteca -- si sí las hay pero
  // esta pieza quedó sin pista (ej. un admin eligió "sin música" a
  // mano), no es este aviso, es una elección válida.
  let avisoSinMusica = false;
  if (!pistaId) {
    const { count } = await supabaseAdmin.from("pistas_musicales").select("id", { count: "exact", head: true }).eq("activo", true).not("licencia_url", "is", null);
    avisoSinMusica = !count;
  }

  // Fase B v2.0 en /contenido (paso 2 del plan de integración): solo
  // las piezas que pasaron por generarGuionConVoz() tienen vozUrl/
  // narracionHash -- las recetas "versión anterior" nunca disparan
  // este aviso. Si el admin edita una narración a mano después de
  // generar la voz, el hash ya no calza -- bloquea "Aprobar" en el
  // cliente (ver PATCH "aprobar" acá mismo) hasta "Regenerar voz".
  const guionActual = pieza.guion as Guion | null;
  const esPiezaConVoz = !!guionActual?.vozUrl;
  const vozDesactualizadaFlag = esPiezaConVoz && vozDesactualizada(guionActual?.narracionHash, guionActual?.escenas ?? []);

  return NextResponse.json({ pieza: pieza as PublicacionOrganica, medios, avisoInfoIncompleta, pistaUrl, pistaSinLicencia, avisoSinMusica, esPiezaConVoz, vozDesactualizada: vozDesactualizadaFlag });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { usuario, error } = await usuarioAdminOFalla(emailBusqueda);
  if (error) return error;

  const cuerpo = await req.json().catch(() => null);

  if (cuerpo?.accion === "editar") {
    // El guion editable de la revisión (sección 2 del plan) -- se
    // revalida contra el mismo zod antes de guardar, para que un campo
    // tocado a mano nunca deje la pieza con un guion inválido.
    const resultado = GuionSchema.safeParse(cuerpo.guion);
    if (!resultado.success) {
      return NextResponse.json({ error: "El guion editado no es válido." }, { status: 400 });
    }
    const caption = typeof cuerpo.caption === "string" ? cuerpo.caption : resultado.data.publicacion?.caption;
    const hashtags = Array.isArray(cuerpo.hashtags) ? cuerpo.hashtags : resultado.data.publicacion?.hashtags;

    const { error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ guion: resultado.data, caption, hashtags, actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", "borrador");

    if (errorUpdate) {
      return NextResponse.json({ error: "No se pudo guardar el guion editado." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }

  if (cuerpo?.accion === "tema") {
    // Tema puntual de la pieza (ej. "por qué tus anuncios no traen
    // mensajes") -- editable en la revisión antes de generar el guion,
    // mismo guard que "editar" (solo mientras sigue en borrador).
    const tema = typeof cuerpo.tema === "string" ? cuerpo.tema.trim().slice(0, 200) || null : null;

    const { error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ tema, actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", "borrador");

    if (errorUpdate) {
      return NextResponse.json({ error: "No se pudo guardar el tema." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, tema });
  }

  if (cuerpo?.accion === "musica") {
    // Elegir música a mano (pedido explícito): a diferencia de la
    // asignación automática (elegirPistaMusicalOrganica, nunca elige
    // una pista sin licencia), acá el ADMIN sí puede elegir cualquier
    // pista, con o sin licencia -- para eso existe esta acción aparte.
    // "Solo pruebas, no publicar" lo muestra la revisión cuando
    // corresponda (GET ya devuelve pistaSinLicencia); acá solo se
    // valida que la pista exista de verdad.
    const pistaId = typeof cuerpo.pista_id === "string" ? cuerpo.pista_id : null;

    if (pistaId) {
      const { data: pista } = await supabaseAdmin.from("pistas_musicales").select("id").eq("id", pistaId).maybeSingle();
      if (!pista) {
        return NextResponse.json({ error: "Esa pista ya no existe." }, { status: 400 });
      }
    }

    const { data: piezaActual } = await supabaseAdmin
      .from("publicaciones_organicas")
      .select("guion, estado")
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .maybeSingle();

    if (!piezaActual?.guion) {
      return NextResponse.json({ error: "Esta pieza todavía no tiene guion." }, { status: 400 });
    }
    if (piezaActual.estado !== "borrador") {
      return NextResponse.json({ error: `Esta pieza está en estado "${piezaActual.estado}", no se puede cambiar la música ahora.` }, { status: 400 });
    }

    const guionConMusicaNueva = { ...(piezaActual.guion as Record<string, unknown>), musica: { ...(piezaActual.guion as { musica?: object }).musica, pista_id: pistaId } };
    const resultadoGuion = GuionSchema.safeParse(guionConMusicaNueva);
    if (!resultadoGuion.success) {
      return NextResponse.json({ error: "No se pudo guardar la música (el guion quedaría inválido)." }, { status: 400 });
    }

    const { error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ guion: resultadoGuion.data, actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", "borrador");

    if (errorUpdate) {
      return NextResponse.json({ error: "No se pudo guardar la música." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }

  if (cuerpo?.accion === "iniciar_render") {
    // Claim atómico -- commit 4c: apenas se aprueba una pieza entra
    // sola a la cola, así que dos pestañas (o la misma recargada)
    // podrían intentar renderizarla al mismo tiempo. Mismo patrón que
    // el claim de video-listo: si el update no afecta ninguna fila,
    // alguien ya se la adjudicó.
    const { data: filas, error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ estado: "renderizando", actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", "aprobada")
      .select("id");

    if (errorUpdate) {
      return NextResponse.json({ error: "No se pudo iniciar el render en este momento." }, { status: 503 });
    }
    if (!filas || filas.length === 0) {
      return NextResponse.json({ error: "Esta pieza ya se está renderizando (u otra pestaña la tomó)." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (cuerpo?.accion === "guardar_calidad") {
    // Paso 3 del plan de integración: ColaDeRender.tsx corre el mismo
    // control de calidad del arnés admin (render + visión + audio)
    // antes de subir al álbum. Esta acción es el único punto donde esa
    // pantalla persiste lo que encontró -- siempre mientras la pieza
    // sigue en "renderizando" (el claim atómico de "iniciar_render" ya
    // la dejó así): (a) un guion recompactado (recompactar.ts, mismo
    // mecanismo del arnés admin, sin volver a llamar la IA ni a
    // generarVoz) antes de reintentar la subida; (b) el hallazgo final
    // si el control de calidad rechaza de verdad (estado="error",
    // tipo_error="calidad"); (c) "forzado" (un admin decide subir
    // igual un reel que no pasó) -- control_calidad.aprobado queda en
    // false, nunca se trata como una aprobación real en ningún lado de
    // la UI (ver /contenido/page.tsx, "Lista, no aprobada").
    const guionNuevo = cuerpo.guion as Record<string, unknown> | undefined;
    const controlCalidad = cuerpo.control_calidad as Record<string, unknown> | undefined;
    const estadoNuevo = cuerpo.estado as "error" | undefined;

    const { data: piezaActual } = await supabaseAdmin.from("publicaciones_organicas").select("estado").eq("id", id).eq("user_id", usuario!.id).maybeSingle();
    if (!piezaActual) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    if (piezaActual.estado !== "renderizando") {
      return NextResponse.json({ error: `Esta pieza está en estado "${piezaActual.estado}", no se puede guardar el control de calidad ahora.` }, { status: 400 });
    }

    const valoresUpdate: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
    if (guionNuevo) {
      const resultadoGuion = GuionSchema.safeParse(guionNuevo);
      if (!resultadoGuion.success) return NextResponse.json({ error: "El guion recompactado no es válido." }, { status: 400 });
      valoresUpdate.guion = resultadoGuion.data;
    }
    if (controlCalidad) valoresUpdate.control_calidad = controlCalidad;
    if (estadoNuevo === "error") {
      valoresUpdate.estado = "error";
      valoresUpdate.tipo_error = "calidad";
    }

    const { error: errorUpdate } = await supabaseAdmin.from("publicaciones_organicas").update(valoresUpdate).eq("id", id).eq("user_id", usuario!.id).eq("estado", "renderizando");
    if (errorUpdate) return NextResponse.json({ error: "No se pudo guardar el control de calidad." }, { status: 503 });
    return NextResponse.json({ ok: true });
  }

  if (cuerpo?.accion === "forzar_sin_calidad") {
    // El admin decide subir un reel que el control de calidad rechazó
    // -- vuelve a "aprobada" (ColaDeRender la vuelve a tomar sola) con
    // una marca que el render de esta vuelta lee para saltarse el
    // gate de calidad (nunca borra los hallazgos anteriores, quedan
    // como evidencia de qué se forzó). Publicar de todos modos (acción
    // aparte, más abajo) es la única que la vuelve elegible para el
    // publicador automático -- "forzar" por sí solo NUNCA basta.
    const { data: piezaActual } = await supabaseAdmin.from("publicaciones_organicas").select("estado, control_calidad").eq("id", id).eq("user_id", usuario!.id).maybeSingle();
    if (!piezaActual) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    if (piezaActual.estado !== "error") {
      return NextResponse.json({ error: `Esta pieza está en estado "${piezaActual.estado}", no se puede forzar.` }, { status: 400 });
    }
    const { error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({
        estado: "aprobada",
        control_calidad: { ...(piezaActual.control_calidad as object), forzarSinCalidad: true },
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", "error");
    if (errorUpdate) return NextResponse.json({ error: "No se pudo forzar la pieza." }, { status: 503 });
    return NextResponse.json({ ok: true });
  }

  if (cuerpo?.accion === "publicar_igual") {
    // Paso 4 (publicador, todavía no construido) leerá esta marca --
    // una pieza "lista" cuyo control de calidad quedó forzado/no
    // aprobado NUNCA es elegible para el cron sin este paso extra y
    // explícito (pedido de Juan José, 17-nov-2026: nunca auto-publicar
    // un reel forzado). "Lista, no aprobada: requiere confirmación" es
    // el estado visible en /contenido hasta que se presione este botón.
    const { data: piezaActual } = await supabaseAdmin.from("publicaciones_organicas").select("estado, control_calidad").eq("id", id).eq("user_id", usuario!.id).maybeSingle();
    if (!piezaActual) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    if (piezaActual.estado !== "lista") {
      return NextResponse.json({ error: `Esta pieza está en estado "${piezaActual.estado}", no se puede marcar para publicar.` }, { status: 400 });
    }
    const controlActual = (piezaActual.control_calidad as { aprobado?: boolean } | null) ?? null;
    if (controlActual?.aprobado !== false) {
      return NextResponse.json({ error: "Esta pieza no necesita este botón -- ya está aprobada normalmente." }, { status: 400 });
    }
    const { error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ control_calidad: { ...controlActual, publicarIgual: true }, actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", "lista");
    if (errorUpdate) return NextResponse.json({ error: "No se pudo marcar la pieza para publicar." }, { status: 503 });
    return NextResponse.json({ ok: true });
  }

  if (cuerpo?.accion === "previa_eliminar" || cuerpo?.accion === "eliminar") {
    // Borrado suave: la pieza pasa a "cancelada" (oculta del calendario,
    // ver GET /api/contenido) y el video se queda en el álbum. Nunca
    // mientras se está publicando: ahí Instagram puede estar a mitad de
    // camino. "previa_eliminar" solo responde si se puede y con qué
    // texto confirmar (el servidor sabe si hay una parte 2 aunque esté
    // fuera de la semana/mes que se mira en el calendario).
    const { data: piezaActual } = await supabaseAdmin
      .from("publicaciones_organicas")
      .select("id, estado, tipo_error")
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .maybeSingle();
    if (!piezaActual) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });

    const evaluacion = evaluarEliminacion(piezaActual.estado as EstadoContenido);
    if (!evaluacion.permitido) return NextResponse.json({ error: evaluacion.motivo }, { status: 400 });

    if (cuerpo.accion === "previa_eliminar") {
      const { data: partes2 } = await supabaseAdmin
        .from("publicaciones_organicas")
        .select("id")
        .eq("user_id", usuario!.id)
        .eq("continua_de_id", id)
        .neq("estado", "cancelada")
        .limit(1);
      const confirmacion = textosConfirmacionEliminar({
        tipo: evaluacion.tipo,
        tieneParte2: (partes2 ?? []).length > 0,
        publicacionSinConfirmar: piezaActual.estado === "error" && piezaActual.tipo_error === "revisar_publicacion",
      });
      return NextResponse.json({ ok: true, tipo: evaluacion.tipo, ...confirmacion });
    }

    const { data: filas, error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ estado: "cancelada", actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", piezaActual.estado)
      .select("id");
    if (errorUpdate) return NextResponse.json({ error: "No se pudo eliminar el reel en este momento." }, { status: 503 });
    if (!filas || filas.length === 0) {
      return NextResponse.json({ error: "Este reel cambió de estado mientras tanto (puede que se esté publicando). Recarga e intenta de nuevo." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (cuerpo?.accion === "reprogramar") {
    // Arrastrar y soltar en el calendario (sección 2 del plan) -- solo
    // cambia programada_para/semana, nunca el estado. Mismo
    // esFechaFutura que al crear: nunca se puede soltar en el pasado.
    const nuevaFecha = typeof cuerpo.programada_para === "string" ? cuerpo.programada_para : null;
    if (!nuevaFecha || !esFechaFutura(nuevaFecha)) {
      return NextResponse.json({ error: "La fecha y hora deben ser futuras." }, { status: 400 });
    }

    const { data: piezaActual } = await supabaseAdmin
      .from("publicaciones_organicas")
      .select("*") // "*" a propósito: sigue funcionando aunque estado_antes_de_vencer todavía no exista en la base (queda undefined -> "borrador")
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .maybeSingle();

    if (!piezaActual) {
      return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    }
    if (ESTADOS_NO_REPROGRAMABLES.includes(piezaActual.estado as EstadoContenido)) {
      return NextResponse.json({ error: `Esta pieza está en estado "${piezaActual.estado}", no se puede reprogramar.` }, { status: 400 });
    }

    const semana = lunesDeLaSemana(fechaBogota(new Date(nuevaFecha)));
    // Solo una pieza "vencida" cambia de estado al reprogramarla (ver
    // estadoAlReprogramar): con video vuelve a "lista", sin video a
    // "aprobada" solo si ya lo estaba antes de vencerse, si no a
    // "borrador". El guion/caption que ya tenía no se toca.
    const nuevoEstado = estadoAlReprogramar(piezaActual as Pick<PublicacionOrganica, "estado" | "url_video" | "estado_antes_de_vencer">);
    const { data: filas, error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({
        programada_para: nuevaFecha,
        semana,
        estado: nuevoEstado,
        ...(piezaActual.estado === "vencida" ? { estado_antes_de_vencer: null } : {}),
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", piezaActual.estado)
      .select("id");

    if (errorUpdate) {
      return NextResponse.json({ error: "No se pudo reprogramar en este momento." }, { status: 503 });
    }
    if (!filas || filas.length === 0) {
      return NextResponse.json({ error: "Esta pieza se actualizó desde otra pestaña, intenta de nuevo." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, semana });
  }

  if (cuerpo?.accion === "regenerar_voz") {
    // Paso 2 del plan de integración: el admin editó una narración a
    // mano y la voz quedó desactualizada (narracionHash ya no calza) --
    // esto vuelve a generar voz/tiempos para el texto ACTUAL, sin
    // volver a llamar a la IA (el texto ya está escrito). Reusa
    // regenerarVozParaGuion(), la misma segunda mitad del pipeline que
    // generarGuionConVoz() ya usa en la generación inicial.
    const { data: piezaActual } = await supabaseAdmin
      .from("publicaciones_organicas")
      .select("guion, estado")
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .maybeSingle();

    const guionActual = piezaActual?.guion as Guion | null;
    if (!guionActual?.vozUrl) {
      return NextResponse.json({ error: "Esta pieza no usa el pipeline con voz." }, { status: 400 });
    }
    if (piezaActual!.estado !== "borrador") {
      return NextResponse.json({ error: `Esta pieza está en estado "${piezaActual!.estado}", no se puede regenerar la voz ahora.` }, { status: 400 });
    }

    const { data: usuarioCreds } = await supabaseAdmin
      .from("usuarios")
      .select("openai_key, cloudinary_name, cloudinary_key, cloudinary_secret")
      .eq("id", usuario!.id)
      .single();
    if (!usuarioCreds?.openai_key) {
      return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones antes de regenerar la voz." }, { status: 400 });
    }
    if (!usuarioCreds.cloudinary_name || !usuarioCreds.cloudinary_key || !usuarioCreds.cloudinary_secret) {
      return NextResponse.json({ error: "Conecta tu cuenta de Cloudinary en Integraciones antes de regenerar la voz." }, { status: 400 });
    }

    let apiKeyUsuario: string;
    let cloudinaryKey: string;
    let cloudinarySecret: string;
    try {
      apiKeyUsuario = desencriptarSiHaceFalta(usuarioCreds.openai_key);
      cloudinaryKey = desencriptarSiHaceFalta(usuarioCreds.cloudinary_key);
      cloudinarySecret = desencriptarSiHaceFalta(usuarioCreds.cloudinary_secret);
    } catch {
      return NextResponse.json({ error: "No se pudo leer alguna de tus llaves guardadas." }, { status: 500 });
    }

    const { data: marca } = await supabaseAdmin.from("marcas").select("voz_tts").eq("email", emailBusqueda).maybeSingle();
    const voz = (marca?.voz_tts as string | null) || VOZ_POR_DEFECTO;

    const resultado = await regenerarVozParaGuion(guionActual.escenas, {
      openaiKey: apiKeyUsuario,
      voz,
      cloudinary: { cloudName: usuarioCreds.cloudinary_name, apiKey: cloudinaryKey, apiSecret: cloudinarySecret },
    });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error, resumenErrores: resultado.resumenErrores }, { status: resultado.status });
    }

    const guionActualizado: Guion = { ...guionActual, ...resultado.campos };
    const { error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ guion: guionActualizado, voz_url: resultado.campos.vozUrl, control_calidad: resultado.crudo ? { crudo: resultado.crudo } : null, actualizado_en: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", usuario!.id)
      .eq("estado", "borrador");

    if (errorUpdate) {
      return NextResponse.json({ error: "No se pudo guardar la voz regenerada." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, guion: guionActualizado });
  }

  if (cuerpo?.accion !== "aprobar") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const { data: pieza } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id, estado, guion, caption, hashtags")
    .eq("id", id)
    .eq("user_id", usuario!.id)
    .maybeSingle();

  if (!pieza) {
    return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  }
  if (pieza.estado !== "borrador") {
    return NextResponse.json({ error: `Esta pieza está en estado "${pieza.estado}", no se puede aprobar.` }, { status: 400 });
  }
  if (!pieza.guion || !pieza.caption || !pieza.hashtags?.length) {
    return NextResponse.json({ error: "Esta pieza todavía no tiene guion. Genera el guion antes de aprobar." }, { status: 400 });
  }
  {
    // Paso 2: nunca aprobar una pieza con voz cuya narración se editó
    // después de generar esa voz -- el admin tiene que regenerarla
    // primero (botón "Regenerar voz" en la revisión).
    const guionParaAprobar = pieza.guion as Guion;
    if (guionParaAprobar.vozUrl && vozDesactualizada(guionParaAprobar.narracionHash, guionParaAprobar.escenas)) {
      return NextResponse.json({ error: "La narración se editó después de generar la voz. Regenera la voz antes de aprobar." }, { status: 400 });
    }
  }

  const { data: filas, error: errorUpdate } = await supabaseAdmin
    .from("publicaciones_organicas")
    .update({ estado: "aprobada", actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", usuario!.id)
    .eq("estado", "borrador")
    .select("id");

  if (errorUpdate) {
    return NextResponse.json({ error: "No se pudo aprobar la pieza en este momento." }, { status: 503 });
  }
  if (!filas || filas.length === 0) {
    return NextResponse.json({ error: "Esta pieza ya se actualizó desde otra pestaña." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
