import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Metas que ya no están activas (canceladas, vencidas o cumplidas) --
// para la sección "Terminadas" de /metas. A diferencia de GET /api/metas
// (las activas, con su avance recalculado), estas ya no cambian, así
// que no hace falta volver a calcular nada -- se devuelven tal cual
// quedaron guardadas al cerrarse.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ metas: [] });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ metas: [] });

  const { data: metas } = await supabaseAdmin
    .from("metas")
    .select("*")
    .eq("user_id", usuario.id)
    .neq("estado", "activa")
    .order("actualizado_en", { ascending: false })
    .limit(50);

  return NextResponse.json({ metas: metas ?? [] });
}
