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
    .from("plantillas_publicitarias")
    .select("*")
    .eq("revisado", false)
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const plantillaIds = (pendientes ?? []).map((p) => p.plantilla_id);

  // Versión activa actual de cada plantilla con pendiente, para poder mostrar el diff
  const { data: activas } = await supabaseAdmin
    .from("plantillas_publicitarias")
    .select("*")
    .eq("activo", true)
    .in("plantilla_id", plantillaIds.length > 0 ? plantillaIds : ["__ninguno__"]);

  const activaPorPlantilla: Record<string, any> = {};
  for (const a of activas ?? []) {
    activaPorPlantilla[a.plantilla_id] = a;
  }

  const resultado = (pendientes ?? []).map((p) => ({
    ...p,
    version_activa: activaPorPlantilla[p.plantilla_id] ?? null,
  }));

  return NextResponse.json({ pendientes: resultado });
}
