import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerCandidatosMeta } from "@/app/lib/adnMarcaFuentes";

const MIN_IMAGENES = 3;

// Sirve dos cosas con una sola llamada a Meta (conteo y listado), porque
// son el mismo costo: si el cliente no tiene conectado Meta, la opción
// ni se muestra (conectado: false). Si está conectado pero salen menos
// de MIN_IMAGENES candidatas, la opción se muestra deshabilitada
// (disponible: false). Si hay suficientes, candidatos ya trae todo lo
// necesario para pintar la grilla sin una segunda consulta.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("meta_access_token, meta_page_id, meta_ad_account_id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario?.meta_access_token || !usuario.meta_page_id) {
    return NextResponse.json({ conectado: false, disponible: false, candidatos: [] });
  }

  try {
    const candidatos = await obtenerCandidatosMeta({
      metaAccessToken: usuario.meta_access_token,
      metaPageId: usuario.meta_page_id,
      metaAdAccountId: usuario.meta_ad_account_id,
    });
    return NextResponse.json({ conectado: true, disponible: candidatos.length >= MIN_IMAGENES, candidatos });
  } catch (err) {
    console.error("Error en GET /api/marca-adn/fuente-meta:", err);
    return NextResponse.json({ conectado: true, disponible: false, candidatos: [] });
  }
}
