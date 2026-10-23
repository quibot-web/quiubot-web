import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminInicioClient from "./AdminInicioClient";

export default async function AdminInicioPage() {
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

  return <AdminInicioClient />;
}
