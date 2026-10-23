import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { CUPOS_FUNDADOR } from "@/app/lib/planesConfig";

// Cuántos cupos de fundador quedan -- SIEMPRE el número real que sale
// de la base (nunca un conteo guardado), para que /billing lo muestre
// sin inventar nada. Pública (ver middleware.ts): /billing la llama
// con o sin sesión. Cuenta a cualquiera que YA tenga fundador_hasta,
// aunque sus 12 meses ya hayan vencido -- los 50 cupos son para los
// primeros 50 que pagaron, no un cupo que se libera con el tiempo.
export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .not("fundador_hasta", "is", null);

  if (error) {
    console.error("Error contando cupos de fundador:", error);
    return NextResponse.json({ restantes: null });
  }

  const restantes = Math.max(0, CUPOS_FUNDADOR - (count ?? 0));
  return NextResponse.json({ restantes });
}
