import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { pausado_autopiloto } = await req.json();
  if (typeof pausado_autopiloto !== "boolean") {
    return NextResponse.json({ error: "pausado_autopiloto debe ser true o false." }, { status: 400 });
  }

  const { data: meta, error } = await supabaseAdmin
    .from("metas")
    .update({ pausado_autopiloto, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", usuario.id)
    .select()
    .single();

  if (error || !meta) {
    return NextResponse.json({ error: "Meta no encontrada." }, { status: 404 });
  }

  await supabaseAdmin.from("bitacora").insert({
    user_id: usuario.id,
    meta_id: meta.id,
    propuesta_id: null,
    tipo_evento: pausado_autopiloto ? "autopiloto_pausado" : "autopiloto_reanudado",
    detalle: {},
  });

  return NextResponse.json({ meta });
}
