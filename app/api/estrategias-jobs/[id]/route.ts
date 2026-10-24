import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarTimeoutJob, type EstrategiaJob } from "@/app/lib/estrategiasJobs";

// Mismo patrón que GET /api/creativos-jobs/[id]: sesión, el job tiene
// que ser del usuario que pregunta (nunca se revela si existe uno de
// otro), y acá además se revisa el timeout de 10 minutos en cada
// consulta -- no hace falta esperar al cron horario si alguien sigue
// mirando la pantalla.
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

    const { data: job } = await supabaseAdmin.from("estrategias_jobs").select("*").eq("id", id).single();
    if (!job || job.user_id !== usuario.id) {
      return NextResponse.json({ ok: false, error: "Job no encontrado" }, { status: 404 });
    }

    const jobActualizado = await revisarTimeoutJob(job as EstrategiaJob);

    // "Entregado" marca que el cliente ya se llevó un resultado "lista"
    // -- lo usa GET /ultimo para no volver a mostrar una estrategia que
    // ya se consumió (ver ese endpoint).
    if (jobActualizado.estado === "lista" && !jobActualizado.entregado) {
      await supabaseAdmin.from("estrategias_jobs").update({ entregado: true }).eq("id", id);
    }

    return NextResponse.json({
      ok: true,
      estado: jobActualizado.estado,
      resultado: jobActualizado.resultado,
      error: jobActualizado.error,
      tipo_error: jobActualizado.tipo_error,
    });
  } catch (err: any) {
    console.error("Error en GET /api/estrategias-jobs/[id]:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error interno del servidor." }, { status: 500 });
  }
}
