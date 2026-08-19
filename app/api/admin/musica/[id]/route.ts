import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarAccesoMusica } from "@/lib/accesoMusica";

// Desactiva/reactiva una pista -- nunca la borra. PATCH con body explícito
// {activo: boolean}, mismo criterio que colaboradores/[id].
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const acceso = await verificarAccesoMusica(session.user.email);
  if (!acceso.permitido) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const { activo } = await req.json();

  if (typeof activo !== "boolean") {
    return NextResponse.json({ error: "Falta el estado activo (boolean)" }, { status: 400 });
  }

  const { data: pista, error: errorPista } = await supabaseAdmin
    .from("pistas_musicales")
    .select("id, cloudinary_name")
    .eq("id", id)
    .single();

  if (errorPista || !pista) {
    return NextResponse.json({ error: "Pista no encontrada" }, { status: 404 });
  }

  // Un colaborador (no admin) solo puede desactivar/reactivar SUS propias
  // pistas -- ni siquiera adivinando el id de una ajena.
  if (!acceso.esAdmin && pista.cloudinary_name !== acceso.cloudinaryName) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("pistas_musicales")
    .update({ activo })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pista: data });
}
