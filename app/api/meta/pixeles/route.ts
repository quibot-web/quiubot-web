import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Trae la lista REAL de pixeles de la cuenta publicitaria ya conectada del
// usuario -- no se guarda nada aqui, solo se consulta a Meta al vuelo para
// que el usuario elija de un dropdown en vez de pegar un ID a mano.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("meta_access_token, meta_ad_account_id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario?.meta_access_token || !usuario?.meta_ad_account_id) {
    return NextResponse.json({ error: "Conecta primero tu cuenta de Meta" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${usuario.meta_ad_account_id}/adspixels?fields=id,name&access_token=${usuario.meta_access_token}`
    );
    const data = await res.json();

    if (data.error) {
      console.error("Error trayendo pixeles de Meta:", data.error);
      return NextResponse.json({ error: "No se pudieron cargar los pixeles de tu cuenta de Meta" }, { status: 502 });
    }

    return NextResponse.json({ pixeles: data.data || [] });
  } catch (err) {
    console.error("Error en /api/meta/pixeles:", err);
    return NextResponse.json({ error: "No se pudo conectar con Meta" }, { status: 500 });
  }
}