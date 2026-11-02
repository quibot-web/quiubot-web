import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";

const LIMITE_DEFECTO = 24;
const LIMITE_MAXIMO = 60;

// Cursor opaco para paginación por teclado (keyset) -- creado_en no
// alcanza solo como desempate (dos subidas en el mismo milisegundo son
// posibles), por eso va con el id. Nunca se expone el formato interno
// al cliente, solo este string codificado.
function codificarCursor(creadoEn: string, id: string): string {
  return Buffer.from(`${creadoEn}|${id}`).toString("base64");
}
function decodificarCursor(cursor: string): { creadoEn: string; id: string } | null {
  try {
    const [creadoEn, id] = Buffer.from(cursor, "base64").toString("utf-8").split("|");
    if (!creadoEn || !id) return null;
    return { creadoEn, id };
  } catch {
    return null;
  }
}

// GET /api/album?limit=24&cursor=<opaco>&tipo=imagen|video -- antes
// traía TODO el álbum de una vez (sin límite), lo que volvía lenta la
// carga del selector con álbumes grandes y pedía las imágenes en su
// tamaño original. Ahora pagina por teclado (creado_en DESC, id DESC)
// y deja que el cliente arme la miniatura (ver urlOptimizadaCloudinary/
// urlPortadaVideo en app/lib/cloudinaryUrl.ts) -- un solo contrato para
// los 4 lugares que llaman a este endpoint.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: usuario, error: errorUsuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (errorUsuario || !usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limitCrudo = parseInt(searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(limitCrudo) && limitCrudo > 0 ? Math.min(limitCrudo, LIMITE_MAXIMO) : LIMITE_DEFECTO;
  const tipo = searchParams.get("tipo");
  const cursorCrudo = searchParams.get("cursor");

  let query = supabaseAdmin
    .from("album_creativos")
    .select("id, url_imagen, public_id, tipo, creado_en")
    .eq("user_id", usuario.id);

  if (tipo === "imagen" || tipo === "video") {
    query = query.eq("tipo", tipo);
  }

  if (cursorCrudo) {
    const cursor = decodificarCursor(cursorCrudo);
    if (!cursor) {
      return NextResponse.json({ error: "Cursor inválido" }, { status: 400 });
    }
    // (creado_en, id) < (cursor.creadoEn, cursor.id) en orden descendente --
    // la fila exactamente en el cursor nunca se repite, y dos filas con el
    // mismo creado_en quedan bien ordenadas por id.
    query = query.or(
      `creado_en.lt.${cursor.creadoEn},and(creado_en.eq.${cursor.creadoEn},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query
    .order("creado_en", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error en consulta de álbum:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filas = data || [];
  const ultima = filas[filas.length - 1];
  const siguienteCursor = filas.length === limit && ultima ? codificarCursor(ultima.creado_en, ultima.id) : null;

  return NextResponse.json({ imagenes: filas, siguienteCursor });
}
