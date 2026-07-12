import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdminObjetivosClient from "./AdminObjetivosClient";

export default async function AdminObjetivosPage() {
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

  return <AdminObjetivosClient />;
}