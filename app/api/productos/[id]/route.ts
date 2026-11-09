import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { ActualizarProductoSchema } from "@/app/lib/productos";

// Editar y archivar comparten esta misma ruta -- archivar es solo
// mandar { activo: false } (nunca se borra un producto de verdad, para
// que lo que ya lo referencia -- metas.contexto, estrategias,
// campanas_publicadas.producto_id -- siga teniendo con qué mostrar su
// historial).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const cuerpo = await req.json().catch(() => null);
  // No es un campo del producto -- se saca antes de validar para que
  // nunca llegue a la tabla por error (el esquema solo tiene las
  // columnas editables de verdad). Lo manda resolverProductoAlUsar en
  // cada uso real, aunque no haya cambiado nada más, para que
  // ultimo_uso_en refleje el uso y no solo las ediciones.
  const marcarUso = !!(cuerpo && typeof cuerpo === "object" && (cuerpo as Record<string, unknown>).marcar_uso === true);
  const resultado = ActualizarProductoSchema.safeParse(cuerpo);
  if (!resultado.success || (Object.keys(resultado.data).length === 0 && !marcarUso)) {
    return NextResponse.json({ error: "No hay nada para actualizar." }, { status: 400 });
  }

  const cambios: Record<string, unknown> = { ...resultado.data, actualizado_en: new Date().toISOString() };
  if (marcarUso) cambios.ultimo_uso_en = new Date().toISOString();

  const { data: producto, error } = await supabaseAdmin
    .from("productos")
    .update(cambios)
    .eq("id", id)
    .eq("user_id", usuario.id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya tienes un producto con ese nombre." }, { status: 409 });
    }

    registrarError({
      origen: "actualizar_producto",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "update_producto",
      errorMensaje: error.message,
      detalleTecnico: JSON.stringify(error),
    });
    return NextResponse.json({ error: "No pude actualizar tu producto en este momento, inténtalo de nuevo en un minuto." }, { status: 500 });
  }

  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ producto });
}
