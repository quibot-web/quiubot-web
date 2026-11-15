import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminPublicarInstagramPruebaClient from "./AdminPublicarInstagramPruebaClient";

// Solo diagnóstico -- publicar en sí es una función real para
// cualquier usuario (botón en /album, ver AlbumUI/page.tsx), no algo
// que se prueba solo acá. Esta pantalla sigue solo-admin porque
// expone el META_CONFIG_ID y la comparación cruda de campos/tokens.
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
