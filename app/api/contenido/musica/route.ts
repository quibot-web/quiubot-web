import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { accesoContenido, esAdmin } from "@/app/lib/accesoContenido";

// Pistas para el selector "Música" de /contenido/[id] (lanzamiento 30 nov
// 2026: antes leía /api/admin/musica, que un cliente no puede abrir). Un
// cliente solo ve pistas activas CON licencia (las únicas que se pueden
// publicar); admin ve todas, también las de "solo pruebas".
export async function GET() {
  const acceso = await accesoContenido();
  if (acceso.error) return acceso.error;
  let consulta = supabaseAdmin.from("pistas_musicales").select("id, nombre, mood, licencia_url").order("mood", { ascending: true }).order("creado_en", { ascending: false });
  if (!esAdmin(acceso.usuario)) consulta = consulta.eq("activo", true).not("licencia_url", "is", null);
  const { data, error } = await consulta;
  if (error) return NextResponse.json({ error: "No se pudo cargar la música." }, { status: 503 });
  return NextResponse.json({ pistas: data ?? [] });
}
