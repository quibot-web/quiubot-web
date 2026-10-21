import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizarBloques } from "@/app/lib/configHome";

async function esAdmin(email: string) {
  const { data } = await supabaseAdmin.from("usuarios").select("rol").eq("email", email).single();
  return data?.rol === "admin";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data } = await supabaseAdmin.from("config_home").select("bloques").eq("id", 1).maybeSingle();
  return NextResponse.json({ bloques: normalizarBloques(data?.bloques) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esAdmin(session.user.email.trim().toLowerCase()))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { bloques } = await req.json();
  if (!Array.isArray(bloques)) {
    return NextResponse.json({ error: "bloques debe ser una lista" }, { status: 400 });
  }

  // Se normaliza también al guardar -- nunca se persiste un id desconocido,
  // y nunca falta uno de los conocidos.
  const limpio = normalizarBloques(bloques);

  const { error } = await supabaseAdmin.from("config_home").update({ bloques: limpio }).eq("id", 1);
  if (error) {
    console.error("Error actualizando config_home:", error);
    return NextResponse.json({ error: "No se pudo guardar el orden" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bloques: limpio });
}
