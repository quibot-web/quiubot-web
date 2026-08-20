import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Mismo patron que /api/creativos-jobs/[id]: GET simple para que el
// frontend haga polling del estado de un job de video (generacion,
// revision, union) sin depender de que el usuario se quede en la misma
// pestaña -- el ?job=<id> de la notificacion apunta aca.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("email", session.user.email.trim().toLowerCase())
      .single();

    if (!usuario) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    const { data: job, error } = await supabaseAdmin
      .from("video_jobs")
      .select("id, estado, segmentos, total_segmentos, video_final_url, texto_cta, regeneraciones_usadas, error_mensaje, user_id, public_id_final, guardado_en_album")
      .eq("id", id)
      .single();

    if (error || !job || job.user_id !== usuario.id) {
      return NextResponse.json({ ok: false, error: "Video no encontrado" }, { status: 404 });
    }

    // Auto-guardado en el Álbum de Creativos -- efecto secundario del
    // polling, una sola vez por job (guardado_en_album como guard de
    // idempotencia). public_id_final puede venir null si n8n todavía no
    // lo completó en ese momento: igual se guarda (mejor tener el video
    // en el álbum sin poder purgarlo de Cloudinary después, que no
    // guardarlo). Un fallo acá nunca debe romper la respuesta normal del
    // polling -- es secundario a que el usuario vea que su video está listo.
    if (job.estado === "listo" && job.video_final_url && !job.guardado_en_album) {
      try {
        await supabaseAdmin.from("album_creativos").insert({
          user_id: usuario.id,
          url_imagen: job.video_final_url,
          public_id: job.public_id_final,
          tipo: "video",
        });
        await supabaseAdmin.from("video_jobs").update({ guardado_en_album: true }).eq("id", id);
      } catch (err) {
        console.error("Error al auto-guardar video en el álbum:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      estado: job.estado,
      segmentos: job.segmentos || [],
      total_segmentos: job.total_segmentos,
      video_final_url: job.video_final_url,
      texto_cta: job.texto_cta,
      regeneraciones_usadas: job.regeneraciones_usadas ?? 0,
      error_mensaje: job.error_mensaje,
    });
  } catch (err: any) {
    console.error("Error en GET /api/video-jobs/[id]:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error interno del servidor." }, { status: 500 });
  }
}
