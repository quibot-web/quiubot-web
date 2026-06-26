import { NextResponse } from "next/server";
import { auth } from "@/auth"; // Ajusta según tu configuración de auth
import { supabaseAdmin } from "@/lib/supabase"; // Asegúrate de tener este import

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Consulta tu tabla donde guardas las imágenes (ajusta 'galeria' al nombre real de tu tabla)
  const { data, error } = await supabaseAdmin
    .from("galeria") 
    .select("url")
    .eq("email", session.user.email)
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imagenes: data });
}