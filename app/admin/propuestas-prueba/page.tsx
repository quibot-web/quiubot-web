// Fase 2 -- relocadas desde /decisiones (decisión del usuario): la
// bandeja real reemplazada por /equipo no era el lugar para
// herramientas de QA. Mismo patrón de gate server-side que el resto de
// /admin (ver app/admin/esferas/page.tsx).
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import PropuestasPruebaClient from "./PropuestasPruebaClient";

export default async function PropuestasPruebaPage() {
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

  return <PropuestasPruebaClient />;
}
