import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { accesoContenido } from "@/app/lib/accesoContenido";
import { recompactarVoz } from "@/app/lib/videoOrganico/recompactarVoz";
import type { Guion } from "@/video/guion.schema";

// Recompactar las pausas de la MISMA voz cuando el control de calidad solo
// encontró pausas largas (antes en /api/admin/reel-automatico-prueba/
// recompactar, que un cliente no puede abrir). Solo el dueño de la pieza.
// La URL de la voz sale de la pieza guardada, nunca del navegador.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await accesoContenido();
  if (acceso.error) return acceso.error;

  const { data: pieza } = await supabaseAdmin.from("publicaciones_organicas").select("id, guion").eq("id", id).eq("user_id", acceso.usuario.id).maybeSingle();
  if (!pieza) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  const vozGuardada = (pieza.guion as Guion | null)?.vozUrl ?? null;

  const cuerpo = await req.json().catch(() => null);
  // El guion que se recompacta tiene que ser el de esta voz.
  if (cuerpo?.guion && (cuerpo.guion as Guion).vozUrl !== vozGuardada) {
    return NextResponse.json({ error: "El guion no corresponde a la voz de esta pieza." }, { status: 400 });
  }
  const r = await recompactarVoz(cuerpo, { vozUrlConfiable: vozGuardada });
  return NextResponse.json(r.cuerpo, { status: r.status });
}
