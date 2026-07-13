import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generarEmbedding } from "@/app/lib/embeddings";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, openai_key")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) {
    return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 }) };
  }
  if (usuario.rol !== "admin") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  if (!usuario.openai_key) {
    return {
      error: NextResponse.json(
        { error: "Necesitas configurar tu API key de OpenAI en Integraciones antes de usar esto." },
        { status: 400 }
      ),
    };
  }

  return { usuario };
}

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { data, error } = await supabaseAdmin
    .from("asistente_conocimiento")
    .select("id, seccion, contenido, actualizado_en")
    .order("actualizado_en", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conocimiento: data });
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { seccion, contenido } = await req.json();

  if (!seccion?.trim() || !contenido?.trim()) {
    return NextResponse.json(
      { error: "Sección y contenido son obligatorios" },
      { status: 400 }
    );
  }

  let embedding: number[];
  try {
    embedding = await generarEmbedding(`${seccion}\n\n${contenido}`, check.usuario!.openai_key);
  } catch (err: any) {
    return NextResponse.json(
      { error: `No se pudo generar el embedding: ${err.message}` },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("asistente_conocimiento")
    .insert({
      seccion: seccion.trim(),
      contenido: contenido.trim(),
      embedding,
    })
    .select("id, seccion, contenido, actualizado_en")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conocimiento: data });
}