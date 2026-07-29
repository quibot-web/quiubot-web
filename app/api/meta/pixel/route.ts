import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Guarda cual pixel (de la lista real que devuelve /api/meta/pixeles) eligio
// el usuario. Solo guarda id + nombre -- no hace falta un token nuevo, ya
// se usa el meta_access_token que el usuario conecto por OAuth con Meta.
// pixelId puede venir en null para "desconectar" el pixel (volver a
// publicar sin optimizacion de conversiones).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { pixelId, pixelNombre } = body;

  if (pixelId === undefined) {
    return NextResponse.json({ error: "Falta el pixelId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("usuarios")
    .update({ meta_pixel_id: pixelId, meta_pixel_nombre: pixelId ? pixelNombre || null : null })
    .eq("email", session.user.email.trim().toLowerCase());

  if (error) {
    console.error("Error guardando pixel:", error);
    return NextResponse.json({ error: "No se pudo guardar el pixel" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}