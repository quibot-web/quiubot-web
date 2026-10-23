import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, rol, plan, en_trial, fecha_vencimiento, beta_autopiloto")
      .eq("email", session.user.email.trim().toLowerCase())
      .single();

    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!tieneAutopiloto(usuario)) {
      return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
    }

    const { data: propuesta } = await supabaseAdmin
      .from("propuestas")
      .select("id, meta_id, estado")
      .eq("id", id)
      .eq("user_id", usuario.id)
      .single();

    if (!propuesta) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
    if (propuesta.estado !== "pendiente") {
      return NextResponse.json({ error: `Esta propuesta ya está en estado "${propuesta.estado}".` }, { status: 409 });
    }

    const ahora = new Date().toISOString();
    await supabaseAdmin
      .from("propuestas")
      .update({ estado: "rechazada", decidido_en: ahora, decidido_por: usuario.id })
      .eq("id", id);

    await supabaseAdmin.from("bitacora").insert({
      user_id: usuario.id,
      meta_id: propuesta.meta_id,
      propuesta_id: propuesta.id,
      tipo_evento: "propuesta_rechazada",
      detalle: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error inesperado en /api/propuestas/[id]/rechazar:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
