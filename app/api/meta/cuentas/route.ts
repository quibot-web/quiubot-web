import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Trae la lista REAL de cuentas publicitarias y paginas de Meta del
// usuario -- no guarda nada, solo consulta al vuelo para que el usuario
// pueda elegir de un dropdown en vez de que el sistema auto-seleccione
// la primera cuenta que encuentre (que es lo que pasaba antes en el
// callback de OAuth, causando publicaciones en la cuenta equivocada).
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("meta_access_token")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario?.meta_access_token) {
    return NextResponse.json({ error: "Conecta primero tu cuenta de Meta" }, { status: 400 });
  }

  try {
    const [cuentasRes, paginasRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,business&access_token=${usuario.meta_access_token}`),
      fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${usuario.meta_access_token}`),
    ]);
    const cuentasData = await cuentasRes.json();
    const paginasData = await paginasRes.json();

    if (cuentasData.error || paginasData.error) {
      console.error("Error trayendo cuentas/paginas de Meta:", cuentasData.error, paginasData.error);
      return NextResponse.json({ error: "No se pudieron cargar tus cuentas de Meta" }, { status: 502 });
    }

    return NextResponse.json({
      cuentasPublicitarias: (cuentasData.data || []).map((c: any) => ({
        id: c.id,
        nombre: c.name,
        businessId: c.business?.id || null,
      })),
      paginas: (paginasData.data || []).map((p: any) => ({ id: p.id, nombre: p.name })),
    });
  } catch (err) {
    console.error("Error en /api/meta/cuentas:", err);
    return NextResponse.json({ error: "No se pudo conectar con Meta" }, { status: 500 });
  }
}