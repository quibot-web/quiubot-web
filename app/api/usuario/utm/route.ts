import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Guarda el UTM de primer contacto del cliente actual -- lo llama
// TrackerRegistroGoogle justo cuando detecta un registro nuevo por
// Google (ver esRegistroNuevo en auth.ts). El flujo de contraseña no
// pasa por aquí: /api/auth/registro ya guarda el UTM directo en el
// mismo insert, porque ahí sí hay una fila nueva en el mismo request.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const utm_source = typeof body.utm_source === "string" ? body.utm_source.slice(0, 200) : null;
  const utm_campaign = typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 200) : null;
  const utm_content = typeof body.utm_content === "string" ? body.utm_content.slice(0, 200) : null;

  if (!utm_source && !utm_campaign && !utm_content) {
    return NextResponse.json({ ok: true });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();

  // Solo si todavía no hay nada guardado -- así una llamada repetida
  // (o una sesión vieja que vuelve a disparar el tracker) nunca
  // sobreescribe la atribución real de primer contacto.
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("utm_source, utm_campaign, utm_content")
    .eq("email", emailBusqueda)
    .maybeSingle();

  if (!usuario || usuario.utm_source || usuario.utm_campaign || usuario.utm_content) {
    return NextResponse.json({ ok: true });
  }

  await supabaseAdmin.from("usuarios").update({ utm_source, utm_campaign, utm_content }).eq("email", emailBusqueda);

  return NextResponse.json({ ok: true });
}
