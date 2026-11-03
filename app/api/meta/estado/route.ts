import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ conectado: false });
  }

  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("meta_ad_account_id, meta_ad_account_nombre, meta_user_name, meta_token_expira, meta_page_id, meta_page_name, meta_pixel_id, meta_pixel_nombre")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  // Antes "conectado" solo miraba si habia una cuenta publicitaria
  // guardada, sin importar si el token seguia vivo -- un token vencido
  // (meta_token_expira en el pasado) seguia mostrando "Conectado" aunque
  // Meta ya rechazara cualquier llamada real. tokenVencido distingue ese
  // caso de "nunca se conecto" para que la UI muestre el mensaje correcto.
  const tokenVencido = !!(data?.meta_token_expira && new Date(data.meta_token_expira) <= new Date());
  const conectado = !!(data && data.meta_ad_account_id) && !tokenVencido;

  return NextResponse.json({
    conectado,
    tokenVencido,
    nombre: data ? data.meta_user_name : null,
    cuentaPublicitaria: data ? data.meta_ad_account_id : null,
    cuentaPublicitariaNombre: data ? data.meta_ad_account_nombre : null,
    pagina: data ? data.meta_page_name : null,
    paginaId: data ? data.meta_page_id : null,
    expira: data ? data.meta_token_expira : null,
    pixelId: data ? data.meta_pixel_id : null,
    pixelNombre: data ? data.meta_pixel_nombre : null,
  });
}