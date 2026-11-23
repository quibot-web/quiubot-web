import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { esFechaFutura, elegirGanchoTipoMenosUsado, lunesDeLaSemana, type PublicacionOrganica } from "@/app/lib/contenido";
import { fechaBogota } from "@/app/lib/fechaBogota";
import { LIMITE_IDEA, MAX_PARTES_SERIE, serieDesdeIdea } from "@/app/lib/ideaUsuario";

// "Tu idea para el video" (24 nov 2026): cuando la idea del usuario no
// cabe en un reel, el guion propone una serie de 2-3 reels y el usuario
// la acepta acá, eligiendo la fecha de cada uno. La parte 1 queda en
// ESTA pieza (su idea pasa a ser la de la parte 1); las demás se crean
// como piezas nuevas, en borrador, enlazadas con continua_de_id (el
// aviso al eliminar ya respeta esa cadena). Solo admin, igual que el
// resto de /contenido.

const SerieSchema = z.object({
  partes: z
    .array(
      z.object({
        idea: z.string().trim().min(3).max(LIMITE_IDEA),
        programada_para: z.iso.datetime({ offset: true }),
      })
    )
    .min(2)
    .max(MAX_PARTES_SERIE),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const email = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id, rol").eq("email", email).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const resultado = SerieSchema.safeParse(await req.json().catch(() => null));
  if (!resultado.success) return NextResponse.json({ error: `La serie necesita entre 2 y ${MAX_PARTES_SERIE} partes, cada una con su idea y su fecha.` }, { status: 400 });
  // Cada parte lleva "Parte k de N." al comienzo de su idea: así el guion
  // de cada una sabe que es serie (gancho propio, repaso, adelanto).
  const partes = resultado.data.partes.map((p, k, todas) => ({ ...p, idea: serieDesdeIdea(p.idea) ? p.idea : `Parte ${k + 1} de ${todas.length}.\n${p.idea}`.slice(0, LIMITE_IDEA) }));
  if (partes.some((p) => !esFechaFutura(p.programada_para))) return NextResponse.json({ error: "Cada parte necesita una fecha y hora futuras." }, { status: 400 });

  const { data: pieza } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("id, estado, receta_organica, producto_id, media_ids, plataforma")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .maybeSingle();
  if (!pieza) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
  if (pieza.estado !== "borrador") return NextResponse.json({ error: `Esta pieza está en estado "${pieza.estado}"; la serie solo se arma en borrador.` }, { status: 400 });

  // Parte 1: esta misma pieza, con la idea y la fecha de la parte 1.
  const primera = partes[0];
  const { error: errorPrimera } = await supabaseAdmin
    .from("publicaciones_organicas")
    .update({ tema: primera.idea, programada_para: primera.programada_para, semana: lunesDeLaSemana(fechaBogota(new Date(primera.programada_para))), actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", usuario.id)
    .eq("estado", "borrador");
  if (errorPrimera) return NextResponse.json({ error: "No se pudo actualizar la parte 1." }, { status: 503 });

  // Partes 2 y 3: piezas nuevas, cada una continúa a la anterior.
  const creadas: PublicacionOrganica[] = [];
  let anterior = id;
  for (const parte of partes.slice(1)) {
    const semana = lunesDeLaSemana(fechaBogota(new Date(parte.programada_para)));
    const { data: piezasSemana } = await supabaseAdmin.from("publicaciones_organicas").select("gancho_tipo").eq("user_id", usuario.id).eq("semana", semana);
    const { data: nueva, error } = await supabaseAdmin
      .from("publicaciones_organicas")
      .insert({
        user_id: usuario.id,
        tema: parte.idea,
        gancho_tipo: elegirGanchoTipoMenosUsado((piezasSemana ?? []).map((p) => p.gancho_tipo as string | null)),
        plataforma: pieza.plataforma ?? "instagram",
        receta_organica: pieza.receta_organica,
        programada_para: parte.programada_para,
        producto_id: pieza.producto_id ?? null,
        media_ids: pieza.media_ids ?? null,
        estado: "borrador",
        semana,
        continua_de_id: anterior,
      })
      .select("*")
      .single();
    if (error || !nueva) return NextResponse.json({ error: "No se pudo crear una de las partes de la serie.", creadas }, { status: 503 });
    creadas.push(nueva as PublicacionOrganica);
    anterior = nueva.id as string;
  }
  return NextResponse.json({ ok: true, creadas }, { status: 201 });
}
