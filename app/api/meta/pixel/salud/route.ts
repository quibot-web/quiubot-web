import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerSaludPixel } from "@/app/lib/metaPixelSalud";

// La lógica real vive en app/lib/metaPixelSalud.ts (compartida con
// verificarRequisitosMeta(), ver app/lib/metas.ts) -- esta ruta solo
// resuelve el usuario de la sesión y delega.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("meta_access_token, meta_ad_account_id, meta_pixel_id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) {
    return NextResponse.json({ conectado: false, ultimo_disparo: null, compras_7d: 0, compras_con_valor: false });
  }

  const salud = await obtenerSaludPixel(usuario);
  return NextResponse.json(salud);
}
