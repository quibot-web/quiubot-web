import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { verificarAccesoMusica } from "@/lib/accesoMusica";
import AdminMusicaClient from "./AdminMusicaClient";

export default async function AdminMusicaPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const acceso = await verificarAccesoMusica(session.user!.email!);
  if (!acceso.permitido) {
    redirect("/");
  }

  return <AdminMusicaClient esAdmin={acceso.esAdmin} />;
}
