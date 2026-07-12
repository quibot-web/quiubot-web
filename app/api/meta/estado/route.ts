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
    .select("meta_ad_account_id, meta_user_name, meta_token_expira, meta_page_id, meta_page_name")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  const conectado = !!(data && data.meta_ad_account_id);

  return NextResponse.json({
    conectado,
    nombre: data ? data.meta_user_name : null,
    cuentaPublicitaria: data ? data.meta_ad_account_id : null,
    pagina: data ? data.meta_page_name : null,
    expira: data ? data.meta_token_expira : null,
  });
}