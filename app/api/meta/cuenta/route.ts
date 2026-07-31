import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Guarda cual cuenta publicitaria o pagina eligio el usuario (de la lista
// real que devuelve /api/meta/cuentas). Antes el callback de OAuth
// auto-seleccionaba la PRIMERA cuenta/pagina que devolvia Meta sin dejar
// elegir -- esto causo que se publicara una campana en la cuenta
// publicitaria equivocada. Este endpoint permite corregirlo despues,
// desde Integraciones, sin tener que reconectar Meta desde cero.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const body = await req.json();
  const { tipo } = body;

  if (tipo === "cuenta_publicitaria") {
    const { adAccountId, adAccountNombre, businessId } = body;
    if (!adAccountId) {
      return NextResponse.json({ error: "Falta adAccountId" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        meta_ad_account_id: adAccountId,
        meta_ad_account_nombre: adAccountNombre || null,
        meta_business_id: businessId || null,
      })
      .eq("email", emailBusqueda);
    if (error) {
      console.error("Error guardando cuenta publicitaria:", error);
      return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (tipo === "pagina") {
    const { pageId, pageNombre } = body;
    if (!pageId) {
      return NextResponse.json({ error: "Falta pageId" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        meta_page_id: pageId,
        meta_page_name: pageNombre || null,
      })
      .eq("email", emailBusqueda);
    if (error) {
      console.error("Error guardando pagina:", error);
      return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "tipo invalido -- debe ser 'cuenta_publicitaria' o 'pagina'" }, { status: 400 });
}