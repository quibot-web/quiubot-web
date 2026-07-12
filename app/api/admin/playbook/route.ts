import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Versiones pendientes de revisión (revisado = false)
  const { data: pendientes, error } = await supabaseAdmin
    .from("ai_playbook")
    .select("*")
    .eq("revisado", false)
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const temas = (pendientes ?? []).map((p) => p.tema);

  // Versión activa actual de cada tema con pendiente, para poder mostrar el diff
  const { data: activas } = await supabaseAdmin
    .from("ai_playbook")
    .select("*")
    .eq("activo", true)
    .in("tema", temas.length > 0 ? temas : ["__ninguno__"]);

  const activaPorTema: Record<string, any> = {};
  for (const a of activas ?? []) {
    activaPorTema[a.tema] = a;
  }

  const resultado = (pendientes ?? []).map((p) => ({
    ...p,
    version_activa: activaPorTema[p.tema] ?? null,
  }));

  return NextResponse.json({ pendientes: resultado });
}