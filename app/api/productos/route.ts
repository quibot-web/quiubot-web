import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { CrearProductoSchema } from "@/app/lib/productos";

// Lista el catálogo activo del usuario -- ordenado por ultimo_uso_en
// (los más usados primero) para que el selector y el contexto del
// Director muestren primero lo más relevante. Los archivados nunca se
// listan acá (no hay "ver archivados" todavía -- no se pidió).
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { data: productos } = await supabaseAdmin
    .from("productos")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("activo", true)
    .order("ultimo_uso_en", { ascending: false, nullsFirst: false })
    .order("creado_en", { ascending: false });

  return NextResponse.json({ productos: productos ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const cuerpo = await req.json().catch(() => null);
  const resultado = CrearProductoSchema.safeParse(cuerpo);
  if (!resultado.success) {
    return NextResponse.json({ error: "Revisa los datos del producto -- falta el nombre o el tipo." }, { status: 400 });
  }

  const { data: producto, error } = await supabaseAdmin
    .from("productos")
    .insert({
      user_id: usuario.id,
      tipo: resultado.data.tipo,
      nombre: resultado.data.nombre,
      precio_cop: resultado.data.precio_cop ?? null,
      destacar: resultado.data.destacar ?? null,
      album_ids: resultado.data.album_ids ?? [],
      url: resultado.data.url ?? null,
    })
    .select()
    .single();

  if (error || !producto) {
    // 23505 = el índice único (user_id, lower(nombre)) where activo --
    // ver docs/sql/productos.sql. Nunca se muestra el texto crudo de
    // Postgres (mismo criterio que /api/metas).
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Ya tienes un producto con ese nombre." }, { status: 409 });
    }

    registrarError({
      origen: "crear_producto",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "insert_producto",
      errorMensaje: error?.message || "No se pudo crear el producto",
      detalleTecnico: error ? JSON.stringify(error) : null,
    });
    return NextResponse.json({ error: "No pude guardar tu producto en este momento, inténtalo de nuevo en un minuto." }, { status: 500 });
  }

  return NextResponse.json({ producto });
}
