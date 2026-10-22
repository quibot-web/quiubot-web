import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ejecutarPropuesta } from "@/app/lib/propuestas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, email, rol, meta_access_token")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { data: propuesta } = await supabaseAdmin
    .from("propuestas")
    .select("*")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .single();

  if (!propuesta) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });

  if (propuesta.estado !== "pendiente") {
    return NextResponse.json({ error: `Esta propuesta ya está en estado "${propuesta.estado}".` }, { status: 409 });
  }
  if (propuesta.vence_en && propuesta.vence_en < new Date().toISOString()) {
    await supabaseAdmin.from("propuestas").update({ estado: "vencida" }).eq("id", id);
    return NextResponse.json({ error: "Esta propuesta venció." }, { status: 409 });
  }

  const resultado = await ejecutarPropuesta(propuesta, usuario);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, motivo: resultado.motivo, paso: resultado.paso }, { status: resultado.status });
  }
  return NextResponse.json({ ok: true });
}
