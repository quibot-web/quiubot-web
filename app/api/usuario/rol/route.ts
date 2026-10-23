import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ rol: null, tieneAutopiloto: false });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("rol, plan, en_trial, fecha_vencimiento, beta_autopiloto")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  return NextResponse.json({
    rol: usuario?.rol || "usuario",
    tieneAutopiloto: usuario ? tieneAutopiloto(usuario) : false,
  });
}