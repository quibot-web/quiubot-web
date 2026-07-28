import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";

// Endpoint interno, NO pensado para el frontend -- lo llama directo el
// workflow de n8n "actualizar_playbook" (que corre por un cron semanal,
// sin que ningun usuario haga clic en nada, así que no hay ninguna
// petición del navegador de la que "colgarnos" para descifrar como en los
// demás flujos). Protegido con un secreto compartido en vez de sesión de
// usuario, porque quien llama es n8n, no una persona logueada.
export async function GET(req: NextRequest) {
  const secreto = req.headers.get("x-internal-secret");
  if (!secreto || secreto !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: usuario, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, openai_key")
    .eq("rol", "admin")
    .limit(1)
    .single();

  if (error || !usuario) {
    return NextResponse.json({ error: "No se encontró un usuario admin" }, { status: 404 });
  }

  if (!usuario.openai_key) {
    return NextResponse.json({ error: "El usuario admin no tiene openai_key configurada" }, { status: 400 });
  }

  let openaiKeyDescifrada: string;
  try {
    openaiKeyDescifrada = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key del admin:", err);
    return NextResponse.json({ error: "No se pudo descifrar la clave" }, { status: 500 });
  }

  return NextResponse.json({ id: usuario.id, openai_key: openaiKeyDescifrada });
}