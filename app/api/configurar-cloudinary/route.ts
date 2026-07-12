import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth"; // Asegúrate de que este archivo exista en tu carpeta raíz o src
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    // 1. Obtener sesión de forma segura
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Obtener datos del cuerpo
    const body = await req.json();

    // 3. Actualizar en Supabase
    // NOTA: Asegúrate de que las columnas 'cloudinary_name', 'cloudinary_key', 
    // y 'cloudinary_secret' existan realmente en tu tabla 'usuarios'
    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({ 
        cloudinary_name: body.name, 
        cloudinary_key: body.key, 
        cloudinary_secret: body.secret 
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