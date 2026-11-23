import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { recompactarVoz } from "@/app/lib/videoOrganico/recompactarVoz";

// Fase B v2.0, ronda J, punto B (revisión de escucha en staging, 18
// nov 2026). Hermano liviano de POST /guion -- NUNCA llama a la IA ni
// a generarVoz() (cero costo, cero variación de la voz real). Solo
// para cuando el control de calidad del arnés (render + visión +
// audio, en AdminReelAutomaticoPruebaClient.tsx) encuentra ÚNICAMENTE
// un problema de pausas (silencio largo) sobre un reel que por lo
// demás está bien: en vez de pedir un guion y una voz nuevas desde
// cero (caro, y sin ninguna garantía de que la nueva toma no tenga el
// mismo problema), recompacta la MISMA voz ya generada -- usando los
// "crudo" (palabrasPorEscenaCrudo + silencios reales) que POST /guion
// ya devolvió -- con límites de pausa más estrictos.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("rol").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await recompactarVoz(await req.json().catch(() => null));
  return NextResponse.json(r.cuerpo, { status: r.status });
}
