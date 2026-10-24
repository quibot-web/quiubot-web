import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarTimeoutJob, type EstrategiaJob } from "@/app/lib/estrategiasJobs";

const UNA_HORA_MS = 60 * 60 * 1000;

// Para retomar sin depender de localStorage (ej. el cliente volvió en
// otro navegador, o le limpiaron el storage): el job más reciente del
// usuario, solo si todavía está en curso, o si quedó "lista" hace menos
// de una hora y nadie se la llevó todavía (entregado: false). Una
// "fallida" nunca se devuelve acá -- no hay nada que retomar, el
// cliente simplemente vuelve a intentar con el formulario que ya tiene.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ ok: true, job: null });

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("email", session.user.email.trim().toLowerCase())
      .single();

    if (!usuario) return NextResponse.json({ ok: true, job: null });

    const { data: job } = await supabaseAdmin
      .from("estrategias_jobs")
      .select("*")
      .eq("user_id", usuario.id)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!job) return NextResponse.json({ ok: true, job: null });

    const jobActualizado = await revisarTimeoutJob(job as EstrategiaJob);

    const enCurso = jobActualizado.estado === "pendiente" || jobActualizado.estado === "procesando";
    const listaSinEntregar =
      jobActualizado.estado === "lista" &&
      !jobActualizado.entregado &&
      Date.now() - new Date(jobActualizado.actualizado_en).getTime() < UNA_HORA_MS;

    if (!enCurso && !listaSinEntregar) {
      return NextResponse.json({ ok: true, job: null });
    }

    if (listaSinEntregar) {
      await supabaseAdmin.from("estrategias_jobs").update({ entregado: true }).eq("id", jobActualizado.id);
    }

    return NextResponse.json({
      ok: true,
      job: {
        id: jobActualizado.id,
        estado: jobActualizado.estado,
        resultado: jobActualizado.resultado,
        error: jobActualizado.error,
        tipo_error: jobActualizado.tipo_error,
      },
    });
  } catch (err: any) {
    console.error("Error en GET /api/estrategias-jobs/ultimo:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error interno del servidor." }, { status: 500 });
  }
}
