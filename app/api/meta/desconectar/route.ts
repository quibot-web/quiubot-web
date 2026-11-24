import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { avisarPublicador } from "@/app/lib/publicadorOrganico";
import { textoReelVencido } from "@/app/lib/director/textosEquipo";
import { CAMPOS_CONEXION_META } from "@/app/lib/metaConexion";

// "Desconectar Meta" en Integraciones (23 nov 2026). Borra lo que Quiubot
// guarda de la conexión de ESTE usuario: el token y los ids/nombres de
// cuenta publicitaria, negocio, página y píxel. La cuenta de Instagram no
// se guarda (se resuelve en vivo desde la página), así que sin página no
// queda ninguna forma de publicar.
//
// Sus reels programados quedan en pausa (el publicador no publica sin Meta:
// enPausaPorMeta en publicadorOrganico.ts) y se reanudan solos si vuelve a
// conectar a tiempo. Se avisa en el chat del Equipo.
//
// No se revocan los permisos en Facebook desde acá: ese permiso es del
// usuario de Facebook, no de esta cuenta de Quiubot, y si el mismo Facebook
// está conectado a otra cuenta de Quiubot, revocarlo la desconectaría
// también. Para quitarle el acceso del todo, el usuario lo hace desde
// Facebook (la pantalla lo explica).
const ESTADOS_PROGRAMADOS = ["aprobada", "renderizando", "lista"];

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const email = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id").eq("email", email).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { error } = await supabaseAdmin.from("usuarios").update(CAMPOS_CONEXION_META).eq("id", usuario.id);
  if (error) return NextResponse.json({ error: "No se pudo desconectar Meta. Intenta de nuevo." }, { status: 503 });

  // Reels que iban a publicarse: quedan en pausa (no se cambian; el
  // publicador los salta mientras no haya Meta).
  const { data: programados } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id")
    .eq("user_id", usuario.id)
    .eq("plataforma", "instagram")
    .in("estado", ESTADOS_PROGRAMADOS);
  const enPausa = (programados ?? []).length;
  if (enPausa > 0) {
    await avisarPublicador({ userId: usuario.id, piezaId: `desconexion-${Date.now()}`, tipoEvento: "reel_vencido", contenido: textoReelVencido({ motivo: "sin_meta" }), sufijo: "sin_meta" });
  }
  return NextResponse.json({ ok: true, enPausa });
}
