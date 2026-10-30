import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarTimeoutTrabajo, TIPO_TRABAJO, type TrabajoPublicarEstrategia } from "@/app/lib/publicarEstrategiaJobs";

// Mismo patrón que GET /api/marca-adn-jobs/[id] y /api/estrategia/
// revisar-imagen-jobs/[id]: sesión, el job tiene que ser del usuario que
// pregunta, y se revisa el timeout (30 min para este tipo) en cada
// consulta -- no hace falta esperar al cron horario para que un trabajo
// atascado deje de parecer "procesando" para siempre.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    if (!usuario) return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });

    const { data: job } = await supabaseAdmin
      .from("trabajos_ia")
      .select("*")
      .eq("id", id)
      .eq("tipo", TIPO_TRABAJO)
      .single();

    if (!job || job.user_id !== usuario.id) {
      return NextResponse.json({ ok: false, error: "Job no encontrado" }, { status: 404 });
    }

    const jobActualizado = await revisarTimeoutTrabajo(job as TrabajoPublicarEstrategia);

    return NextResponse.json({
      ok: true,
      estado: jobActualizado.estado,
      resultado: jobActualizado.resultado,
      error: jobActualizado.error,
    });
  } catch (err: any) {
    console.error("Error en GET /api/publicar-estrategia-jobs/[id]:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error interno del servidor." }, { status: 500 });
  }
}
