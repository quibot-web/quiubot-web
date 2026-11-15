import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { diagnosticarCuentaInstagramDeLaPagina } from "@/app/lib/metaInstagramSalud";

// Solo diagnóstico -- publicar en sí vive en
// app/api/album/[id]/publicar-instagram/route.ts (función real para
// cualquier usuario con Meta e Instagram conectados, no solo admin:
// Meta exige que instagram_content_publish se use en una función real,
// no en una pantalla de prueba). Esta ruta se queda solo-admin porque
// expone el META_CONFIG_ID y la comparación cruda de campos/tokens, que
// no tiene sentido mostrarle a un usuario normal.
const GRAPH_API_VERSION = "v21.0";

async function resolverUsuarioAdmin(email: string) {
  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, meta_page_id, meta_access_token")
    .eq("email", email.trim().toLowerCase())
    .single();
  return usuario;
}

// GET -- diagnóstico, pedido por Juan José tras el error real "(#10)
// Application does not have permission for this action" al publicar.
// Nunca devuelve el token en sí, solo METADATOS sobre la conexión:
// qué permisos tiene el token guardado (GET /me/permissions -- lo
// único que de verdad dice si Meta ya le dio Acceso avanzado/estándar
// a cada permiso, o si ni siquiera está pedido), el META_CONFIG_ID de
// este ambiente (solo el número, no es secreto -- es público en la URL
// de /api/meta/conectar) y el tipo de cuenta de Instagram vinculada.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const usuario = await resolverUsuarioAdmin(session.user.email);
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (usuario.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const metaConfigId = process.env.META_CONFIG_ID || null;

  if (!usuario.meta_page_id || !usuario.meta_access_token) {
    return NextResponse.json({ meta_config_id: metaConfigId, permisos: [], instagram: null, error: "Conecta tu cuenta de Meta primero." });
  }

  let permisos: { permission: string; status: string }[] = [];
  try {
    const permisosRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/permissions?access_token=${usuario.meta_access_token}`
    );
    const permisosData = await permisosRes.json();
    if (Array.isArray(permisosData?.data)) {
      permisos = permisosData.data.map((p: { permission: string; status: string }) => ({ permission: p.permission, status: p.status }));
    }
  } catch (err) {
    console.error("Error consultando /me/permissions:", err);
  }

  // Diagnóstico crudo pedido explícito tras el error "(#10)": compara
  // instagram_business_account vs. connected_instagram_account, con el
  // token de usuario y con el de la página, en vez de asumir cuál de
  // los 2 campos tiene el id -- ver app/lib/metaInstagramSalud.ts.
  let diagnosticoCuenta;
  try {
    diagnosticoCuenta = await diagnosticarCuentaInstagramDeLaPagina(usuario.meta_page_id, usuario.meta_access_token);
  } catch (err) {
    console.error("Error diagnosticando la cuenta de Instagram:", err);
    diagnosticoCuenta = null;
  }

  // instagram se deriva DIRECTO de diagnosticoCuenta.resolucion -- la
  // misma fuente de verdad que ya usa publicar (nunca una llamada
  // aparte que pudiera responder algo distinto, que era como se
  // explicaba el bug real "dice no conectada aunque publicar funciona").
  const resolucion = diagnosticoCuenta?.resolucion;
  const instagram =
    resolucion && "encontrada" in resolucion && resolucion.encontrada
      ? { conectado: true, igUserId: resolucion.igUserId, username: resolucion.username, account_type: diagnosticoCuenta?.accountType ?? null }
      : { conectado: false, igUserId: null, username: null, account_type: null };

  return NextResponse.json({
    meta_config_id: metaConfigId,
    permisos,
    instagram,
    diagnostico_cuenta: diagnosticoCuenta,
  });
}
