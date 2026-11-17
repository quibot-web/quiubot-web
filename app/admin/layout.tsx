import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { obtenerInfoBuild } from "@/app/lib/buildInfo";

// Envuelve TODAS las /admin/* -- cada página sigue con su propio gate
// (session + rol === "admin" -> redirect) para controlar el ACCESO;
// este layout nunca redirige, solo decide si muestra la línea de
// versión. Si una página redirige, Next corta la respuesta entera
// antes de que esto llegue al navegador -- no hay forma de que un
// no-admin vea el commit, aunque este layout "envuelva" la página.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let esAdmin = false;
  if (session?.user?.email) {
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("rol")
      .eq("email", session.user.email.trim().toLowerCase())
      .maybeSingle();
    esAdmin = usuario?.rol === "admin";
  }

  return (
    <>
      {children}
      {esAdmin && <InsigniaVersion />}
    </>
  );
}

function InsigniaVersion() {
  const { commit, fecha } = obtenerInfoBuild();
  const fechaLegible = fecha
    ? new Date(fecha).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "sin fecha";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 6,
        right: 8,
        fontSize: 11,
        fontFamily: "monospace",
        color: "#999",
        background: "rgba(255,255,255,0.85)",
        padding: "2px 6px",
        borderRadius: 4,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {commit} · {fechaLegible}
    </div>
  );
}
