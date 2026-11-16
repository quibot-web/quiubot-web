import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminReelAutomaticoPruebaClient from "./AdminReelAutomaticoPruebaClient";

// Fase B v2.0, paso 8 del plan (docs/diseno/plan_contenido_organico_fase_b_v2.md)
// -- arnés de prueba del único reel automático. Solo admin: corre la
// cadena completa (guion con voz -> narración/TTS/timestamps reales ->
// visuales con eventos -> sonido en capas -> control de calidad ->
// render en el navegador) y entrega el mp4, sin tocar
// publicaciones_organicas (no es una pieza real, no entra al calendario).
export default async function ReelAutomaticoPruebaPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login?modo=ingresar");
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user!.email!.trim().toLowerCase())
    .single();

  if (!usuario || usuario.rol !== "admin") {
    redirect("/");
  }

  return <AdminReelAutomaticoPruebaClient />;
}
