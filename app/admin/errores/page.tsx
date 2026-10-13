import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminErroresClient from "./AdminErroresClient";

export default async function AdminErroresPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user!.email!.trim().toLowerCase())
    .single();

  if (!usuario || usuario.rol !== "admin") {
    redirect("/");
  }

  const notificarPorCorreo = process.env.NOTIFICAR_ERRORES_POR_CORREO === "true";

  return <AdminErroresClient notificarPorCorreo={notificarPorCorreo} />;
}