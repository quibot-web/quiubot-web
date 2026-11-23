import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminReelIlustradoPruebaClient from "./AdminReelIlustradoPruebaClient";
import { estadoReelIlustrado } from "@/app/lib/reelIlustrado";

// Reel ilustrado, fase 1: arnés de prueba del motor genérico. Solo
// admin: genera la voz real del guion del prototipo (o usa tiempos
// sintéticos, sin costo), renderiza en el navegador y muestra cuánto
// tardó (meta: <= 5 s de render por segundo de video). No toca
// publicaciones_organicas.
export default async function ReelIlustradoPruebaPage() {
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

  // Se calcula en el servidor (donde vive la variable): el cliente solo
  // recibe sí/no, cuántos correos hay y el correo de la sesión enmascarado.
  return <AdminReelIlustradoPruebaClient estado={estadoReelIlustrado(session!.user!.email)} />;
}
