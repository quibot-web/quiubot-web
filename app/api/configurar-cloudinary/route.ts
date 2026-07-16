import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encriptar } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();

    if (!body.name?.trim() || !body.key?.trim() || !body.secret?.trim()) {
      return NextResponse.json({ error: "Los 3 campos son obligatorios" }, { status: 400 });
    }

    // cloudinary_name no es sensible (aparece público en cada URL de imagen),
    // pero cloudinary_key y cloudinary_secret sí, así que se guardan cifradas.
    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        cloudinary_name: body.name.trim(),
        cloudinary_key: encriptar(body.key.trim()),
        cloudinary_secret: encriptar(body.secret.trim()),
      })
      .eq("email", session.user.email);

    if (error) {
      console.error("Error en Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error interno:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}