import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Gestión de colaboradores_musica -- admin-only sin excepción, por eso NO
// usa verificarAccesoMusica (que también deja pasar colaboradores): mismo
// guard simple de rol admin que el resto del proyecto.
async function buscarUsuarioAdmin(email: string) {
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", email.trim().toLowerCase())
    .single();
  return usuario;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const usuario = await buscarUsuarioAdmin(session.user.email);
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("colaboradores_musica")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ colaboradores: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const usuario = await buscarUsuarioAdmin(session.user.email);
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { email } = await req.json();
  const emailNuevo = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!emailNuevo || !emailNuevo.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  // No hace falta que ya exista en usuarios -- si esa persona nunca inicia
  // sesión con ese correo, el permiso simplemente nunca se llega a usar.
  const { data, error } = await supabaseAdmin
    .from("colaboradores_musica")
    .insert({ email: emailNuevo, activo: true, agregado_por: usuario.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ colaborador: data });
}
