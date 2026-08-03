import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("rol")
    .eq("email", emailBusqueda)
    .single();

  if (usuario?.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const origen = searchParams.get("origen") || "";
  const paso = searchParams.get("paso") || "";
  const objetivoId = searchParams.get("objetivo_id") || "";
  const desde = searchParams.get("desde") || "";
  const hasta = searchParams.get("hasta") || "";
  const pagina = Math.max(1, parseInt(searchParams.get("pagina") || "1", 10));
  const porPagina = 30;

  let query = supabaseAdmin
    .from("errores_publicacion")
    .select("*", { count: "exact" })
    .order("creado_en", { ascending: false });

  if (q) {
    query = query.or(`email.ilike.%${q}%,campana_nombre.ilike.%${q}%`);
  }
  if (origen) query = query.eq("origen", origen);
  if (paso) query = query.eq("paso", paso);
  if (objetivoId) query = query.eq("objetivo_id", objetivoId);
  if (desde) query = query.gte("creado_en", desde);
  if (hasta) query = query.lte("creado_en", hasta);

  const desdeIdx = (pagina - 1) * porPagina;
  query = query.range(desdeIdx, desdeIdx + porPagina - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error consultando errores_publicacion:", error);
    return NextResponse.json({ error: "No se pudo cargar los errores" }, { status: 500 });
  }

  return NextResponse.json({
    errores: data || [],
    total: count || 0,
    pagina,
    porPagina,
  });
}