import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { CrearPiezaManualSchema, lunesDeLaSemana, type PublicacionOrganica } from "@/app/lib/contenido";
import { fechaBogota, hoyBogota } from "@/app/lib/fechaBogota";

// Calendario semanal de /contenido (commit 4a, ver
// docs/diseno/plan_contenido_organico.md sección 2). Solo admin, igual
// que el resto del plan hasta que se abra a clientes.

async function usuarioAdminOFalla(email: string) {
  const { data: usuario } = await supabaseAdmin.from("usuarios").select("id, rol").eq("email", email).single();
  if (!usuario) return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) };
  if (usuario.rol !== "admin") return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  return { usuario };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { usuario, error } = await usuarioAdminOFalla(emailBusqueda);
  if (error) return error;

  const semanaParam = req.nextUrl.searchParams.get("semana");
  const semana = semanaParam ? lunesDeLaSemana(semanaParam) : lunesDeLaSemana(hoyBogota());

  const { data: piezas, error: errorLectura } = await supabaseAdmin
    .from("publicaciones_organicas")
    .select("*")
    .eq("user_id", usuario!.id)
    .eq("semana", semana)
    .order("programada_para", { ascending: true });

  if (errorLectura) {
    console.error("Error leyendo el calendario de /contenido:", errorLectura);
    registrarError({
      origen: "contenido_calendario",
      userId: usuario!.id,
      email: emailBusqueda,
      paso: "leer_semana",
      errorMensaje: "No se pudo cargar el calendario.",
      detalleTecnico: errorLectura.message,
    });
    return NextResponse.json({ error: "No se pudo cargar el calendario en este momento." }, { status: 503 });
  }

  return NextResponse.json({ semana, piezas: (piezas ?? []) as PublicacionOrganica[] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { usuario, error } = await usuarioAdminOFalla(emailBusqueda);
  if (error) return error;

  const cuerpo = await req.json().catch(() => null);
  const resultado = CrearPiezaManualSchema.safeParse(cuerpo);
  if (!resultado.success) {
    return NextResponse.json({ error: "Datos inválidos para crear el reel." }, { status: 400 });
  }
  const { receta_organica, programada_para, producto_id } = resultado.data;
  const semana = lunesDeLaSemana(fechaBogota(new Date(programada_para)));

  const { data: pieza, error: errorInsert } = await supabaseAdmin
    .from("publicaciones_organicas")
    .insert({
      user_id: usuario!.id,
      plataforma: "instagram",
      receta_organica,
      programada_para,
      producto_id: producto_id ?? null,
      estado: "borrador",
      semana,
    })
    .select("*")
    .single();

  if (errorInsert || !pieza) {
    console.error("Error creando reel manual en /contenido:", errorInsert);
    registrarError({
      origen: "contenido_calendario",
      userId: usuario!.id,
      email: emailBusqueda,
      paso: "crear_manual",
      errorMensaje: "No se pudo crear el reel.",
      detalleTecnico: errorInsert?.message ?? "sin pieza devuelta",
    });
    return NextResponse.json({ error: "No se pudo crear el reel en este momento." }, { status: 503 });
  }

  return NextResponse.json({ pieza: pieza as PublicacionOrganica }, { status: 201 });
}
