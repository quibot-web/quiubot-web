import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
      .from("creativos_jobs")
      .select("id, estado, creativos, total_creativos, error_mensaje, user_id, guardado_en_album")
      .eq("id", id)
      .single();

    if (error || !job || job.user_id !== usuario.id) {
      return NextResponse.json({ ok: false, error: "Job no encontrado" }, { status: 404 });
    }

    // Auto-guardado en el Álbum de Creativos -- mismo criterio que
    // /api/video-jobs/[id]: efecto secundario del polling, una sola vez
    // por job (guardado_en_album como guard). Cada creativo ya trae su
    // propio public_id (se usa hoy como key en la grilla de revisión), así
    // que acá sí queda completo desde el principio, sin el hueco que tiene
    // video con public_id_final. Un fallo acá nunca debe romper la
    // respuesta normal del polling.
    const creativos = job.creativos || [];
    if (job.estado === "listo" && creativos.length > 0 && !job.guardado_en_album) {
      try {
        await supabaseAdmin.from("album_creativos").insert(
          creativos
            .filter((c: any) => c?.url_imagen)
            .map((c: any) => ({
              user_id: usuario.id,
              url_imagen: c.url_imagen,
              public_id: c.public_id ?? null,
              tipo: "imagen",
            }))
        );
        await supabaseAdmin.from("creativos_jobs").update({ guardado_en_album: true }).eq("id", id);
      } catch (err) {
        console.error("Error al auto-guardar creativos en el álbum:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      estado: job.estado,
      creativos,
      // Cuántos anuncios se espera generar en total -- null mientras el
      // primer paso del workflow todavía no lo haya guardado (se actualiza
      // apenas arranca el loop, así que solo dura null una fracción de segundo).
      total_creativos: job.total_creativos ?? null,
      error_mensaje: job.error_mensaje,
    });
  } catch (err: any) {
    console.error("Error en GET /api/creativos-jobs/[id]:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error interno del servidor." }, { status: 500 });
  }
}
