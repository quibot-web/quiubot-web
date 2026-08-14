import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  // La fila a aprobar, para saber a que plantilla_id pertenece
  const { data: pendiente, error: errorPendiente } = await supabaseAdmin
    .from("plantillas_publicitarias")
    .select("id, plantilla_id")
    .eq("id", id)
    .single();

  if (errorPendiente || !pendiente) {
    return NextResponse.json({ error: errorPendiente?.message || "Plantilla no encontrada" }, { status: 404 });
  }

  // Desactiva cualquier version activa previa de la misma plantilla antes de
  // activar la nueva -- sin esto podrian quedar dos filas con activo=true
  // para el mismo plantilla_id, y el workflow de n8n que consume esta tabla
  // espera exactamente una (WHERE plantilla_id = $1 AND activo = true LIMIT 1).
  const { error: errorDesactivar } = await supabaseAdmin
    .from("plantillas_publicitarias")
    .update({ activo: false })
    .eq("plantilla_id", pendiente.plantilla_id)
    .eq("activo", true);

  if (errorDesactivar) return NextResponse.json({ error: errorDesactivar.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("plantillas_publicitarias")
    .update({ revisado: true, activo: true })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Borra la notificación asociada a esta versión, ya que fue resuelta (aprobada)
  await supabaseAdmin
    .from("notificaciones")
    .delete()
    .eq("accion_sugerida->>plantilla_publicitaria_id", id);

  return NextResponse.json({ plantilla: data });
}
