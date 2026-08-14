import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminPlantillasPublicitariasClient from "./AdminPlantillasPublicitariasClient";

export default async function AdminPlantillasPublicitariasPage() {
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

  return <AdminPlantillasPublicitariasClient />;
}
