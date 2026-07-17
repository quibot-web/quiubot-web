import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Reutiliza la misma tabla de "tutoriales vistos", pero con la sección marcada
// con el sufijo __tour, para no mezclarse con el estado del video de esa sección.
function claveDelTour(seccion: string) {
  return `${seccion}__tour`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ seccion: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ visto: true });
  }

  const { seccion } = await params;
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!usuario) {
    return NextResponse.json({ visto: true });
  }

  const { data: vistoRow } = await supabaseAdmin
    .from("usuarios_tutoriales_vistos")
    .select("id")
    .eq("user_id", usuario.id)
    .eq("seccion", claveDelTour(seccion))
    .maybeSingle();

  return NextResponse.json({ visto: !!vistoRow });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ seccion: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { seccion } = await params;
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("usuarios_tutoriales_vistos")
    .upsert(
      { user_id: usuario.id, seccion: claveDelTour(seccion) },
      { onConflict: "user_id,seccion" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}