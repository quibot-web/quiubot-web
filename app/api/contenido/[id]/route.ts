import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GuionSchema } from "@/video/guion.schema";
import { ESTADOS_NO_REPROGRAMABLES, esFechaFutura, lunesDeLaSemana, type EstadoContenido, type PublicacionOrganica } from "@/app/lib/contenido";
import { fechaBogota } from "@/app/lib/fechaBogota";

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

  return NextResponse.json({ pieza: pieza as PublicacionOrganica, medios });
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
      .select("id, estado")
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
    const { data: filas, error: errorUpdate } = await supabaseAdmin
      .from("publicaciones_organicas")
      .update({ programada_para: nuevaFecha, semana, actualizado_en: new Date().toISOString() })
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
