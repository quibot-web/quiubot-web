import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { CrearProductoSchema } from "@/app/lib/productos";

// Lista el catálogo del usuario -- activo por defecto, o archivado con
// ?archivados=1 ("Ver archivados" + restaurar). Ordenado por
// ultimo_uso_en (los más usados primero) para que el selector y el
// contexto del Director muestren primero lo más relevante.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const archivados = new URL(req.url).searchParams.get("archivados") === "1";

  const { data: productos } = await supabaseAdmin
    .from("productos")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("activo", !archivados)
    .order("ultimo_uso_en", { ascending: false, nullsFirst: false })
    .order("creado_en", { ascending: false });

  const respuesta: { productos: unknown[]; archivadosCount?: number } = {
    productos: await adjuntarFotos(productos ?? []),
  };

  // El contador de archivados solo hace falta en la lista activa (para
  // el botón "Ver archivados (N)") -- pedirlo también en la vista de
  // archivados sería una consulta de más sin ningún uso.
  if (!archivados) {
    const { count } = await supabaseAdmin.from("productos").select("id", { count: "exact", head: true }).eq("user_id", usuario.id).eq("activo", false);
    respuesta.archivadosCount = count ?? 0;
  }

  return NextResponse.json(respuesta);
}

// Resuelve album_ids -> {id, url_imagen} reales -- si un id ya no
// existe en el álbum del usuario (se borró esa foto), se ignora sin
// error; nunca rompe la tarjeta. Se guarda el id junto a la url para
// que el formulario de edición sepa exactamente qué está seleccionado.
async function adjuntarFotos(productos: { album_ids: unknown }[]): Promise<unknown[]> {
  const idsUnicos = [...new Set(productos.flatMap((p) => (Array.isArray(p.album_ids) ? (p.album_ids as string[]) : [])))];
  if (idsUnicos.length === 0) {
    return productos.map((p) => ({ ...p, fotos: [] }));
  }

  const { data: items } = await supabaseAdmin.from("album_creativos").select("id, url_imagen").in("id", idsUnicos);
  const urlPorId = new Map((items ?? []).map((it) => [it.id as string, it.url_imagen as string]));

  return productos.map((p) => ({
    ...p,
    fotos: (Array.isArray(p.album_ids) ? (p.album_ids as string[]) : [])
      .map((id) => ({ id, url_imagen: urlPorId.get(id) }))
      .filter((f): f is { id: string; url_imagen: string } => !!f.url_imagen),
  }));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const cuerpo = await req.json().catch(() => null);
  // Igual que en PATCH [id]: no es un campo del producto, se saca antes
  // de validar. Lo manda resolverProductoAlUsar al crear uno nuevo
  // directamente desde un uso real (metas/estrategia/video) -- creado
  // desde "Mi marca" en cambio no se ha usado todavía, así que
  // ultimo_uso_en se queda en null hasta su primer uso real.
  const marcarUso = !!(cuerpo && typeof cuerpo === "object" && (cuerpo as Record<string, unknown>).marcar_uso === true);
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
      ultimo_uso_en: marcarUso ? new Date().toISOString() : null,
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
