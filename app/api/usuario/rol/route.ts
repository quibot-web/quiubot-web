import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ rol: null });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  return NextResponse.json({ rol: usuario?.rol || "usuario" });
}