import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
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

  const [propuestasRes, bitacoraRes] = await Promise.all([
    supabaseAdmin
      .from("propuestas")
      .select("*")
      .eq("user_id", usuario.id)
      .neq("estado", "pendiente")
      .order("creado_en", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("bitacora")
      .select("*")
      .eq("user_id", usuario.id)
      .order("creado_en", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    propuestas: propuestasRes.data ?? [],
    bitacora: bitacoraRes.data ?? [],
  });
}
