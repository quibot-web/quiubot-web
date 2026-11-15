import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminPublicarInstagramPruebaClient from "./AdminPublicarInstagramPruebaClient";

// Solo existe para sostener el video de revisión de App Review de Meta
// del permiso instagram_content_publish -- ver el plan de "Meta App
// Review" vigente. No es parte de la Fase B de contenido orgánico
// (en pausa): publica a mano, un video del álbum a la vez, sin
// calendario ni cron.
export default async function PublicarInstagramPruebaPage() {
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

  return <AdminPublicarInstagramPruebaClient />;
}
