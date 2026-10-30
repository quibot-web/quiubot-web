import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { revisarTimeoutTrabajo, TIPO_TRABAJO, type TrabajoPublicarEstrategia } from "@/app/lib/publicarEstrategiaJobs";

// Respaldo para retomar sin depender de localStorage (ej. el cliente
// volvió en otro navegador, o le limpiaron el storage) -- mismo patrón
// que GET /api/estrategias-jobs/ultimo. A diferencia de ese, acá solo
// importa "en curso" (pendiente/procesando): trabajos_ia no tiene un
// campo "entregado" para saber si una "lista" ya se le mostró al
// cliente, así que una publicación ya resuelta simplemente no se
// retoma por esta vía -- si el cliente perdió el localStorage justo
// cuando terminó, ve el wizard normal (el resultado real ya quedó en
// campanas_publicadas de todos modos). Una "fallida" tampoco se
// devuelve -- no hay nada que retomar.
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
      .from("trabajos_ia")
      .select("*")
      .eq("user_id", usuario.id)
      .eq("tipo", TIPO_TRABAJO)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!job) return NextResponse.json({ ok: true, job: null });

    const jobActualizado = await revisarTimeoutTrabajo(job as TrabajoPublicarEstrategia);

    const enCurso = jobActualizado.estado === "pendiente" || jobActualizado.estado === "procesando";
    if (!enCurso) {
      return NextResponse.json({ ok: true, job: null });
    }

    return NextResponse.json({
      ok: true,
      job: { id: jobActualizado.id, estado: jobActualizado.estado, resultado: jobActualizado.resultado, error: jobActualizado.error },
    });
  } catch (err: any) {
    console.error("Error en GET /api/publicar-estrategia-jobs/ultimo:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error interno del servidor." }, { status: 500 });
  }
}
