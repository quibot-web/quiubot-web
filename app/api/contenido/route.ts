import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { accesoContenido, duenoParaLeer, recursosSonDelUsuario } from "@/app/lib/accesoContenido";
import { CrearPiezaManualSchema, elegirGanchoTipoMenosUsado, lunesDeLaSemana, type PublicacionOrganica } from "@/app/lib/contenido";
import { vencerPiezasSinVideo } from "@/app/lib/publicadorOrganico";
import { fechaBogota, hoyBogota, inicioDiaBogota, finDiaBogota } from "@/app/lib/fechaBogota";

// Calendario de /contenido (commit 4a, ver docs/diseno/plan_contenido_organico.md
// sección 2). Cada usuario con suscripción activa ve y crea SUS piezas;
// admin puede ver además el calendario de un cliente con ?usuario=<id>
// (solo lectura). Ver app/lib/accesoContenido.ts.

export async function GET(req: NextRequest) {
  const acceso = await accesoContenido("", { soloLectura: true });
  if (acceso.error) return acceso.error;
  const { usuario, email: emailBusqueda } = acceso;
  const dueno = duenoParaLeer(usuario, req.nextUrl.searchParams.get("usuario"));

  // Vencer piezas sin video (commit 4d, "avisos"): si programada_para
  // ya pasó y la pieza sigue en un estado de antes de tener video real
  // (ESTADOS_SIN_VIDEO_AUN), se marca "vencida" -- cada vez que se carga
  // el calendario, además del cron publicar-organico. La misma función
  // en los dos lados, para que el aviso del Publicador en el chat del
  // Equipo salga sin importar quién la venza primero. "error" y "lista"
  // quedan afuera a propósito, ver el comentario de ESTADOS_SIN_VIDEO_AUN.
  await vencerPiezasSinVideo({ userId: dueno });

  // Vista de mes (rediseño, sección 2 del plan): la cuadrícula de un
  // mes no se alinea con el campo "semana" (una grilla de 6 semanas
  // puede empezar en el mes anterior), así que ahí se filtra por rango
  // real de programada_para en vez de por semana exacta. La vista de
  // semana sigue usando ?semana= como antes.
  const desdeParam = req.nextUrl.searchParams.get("desde");
  const hastaParam = req.nextUrl.searchParams.get("hasta");

  // Las eliminadas ("cancelada", borrado suave) nunca se muestran en
  // el calendario -- siguen en la base, y su video en el álbum.
  let consulta = supabaseAdmin.from("publicaciones_organicas").select("*").eq("user_id", dueno).neq("estado", "cancelada");
  let semana = "";

  if (desdeParam && hastaParam) {
    consulta = consulta.gte("programada_para", inicioDiaBogota(desdeParam).toISOString()).lte("programada_para", finDiaBogota(hastaParam).toISOString());
  } else {
    const semanaParam = req.nextUrl.searchParams.get("semana");
    semana = semanaParam ? lunesDeLaSemana(semanaParam) : lunesDeLaSemana(hoyBogota());
    consulta = consulta.eq("semana", semana);
  }

  const { data: piezas, error: errorLectura } = await consulta.order("programada_para", { ascending: true });

  if (errorLectura) {
    console.error("Error leyendo el calendario de /contenido:", errorLectura);
    registrarError({
      origen: "contenido_calendario",
      userId: usuario.id,
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
  const acceso = await accesoContenido();
  if (acceso.error) return acceso.error;
  const { usuario, email: emailBusqueda } = acceso;

  const cuerpo = await req.json().catch(() => null);
  const resultado = CrearPiezaManualSchema.safeParse(cuerpo);
  if (!resultado.success) {
    return NextResponse.json({ error: "Datos inválidos para crear el reel." }, { status: 400 });
  }
  const { receta_organica, programada_para, producto_id, media_ids, tema } = resultado.data;
  // El producto y las piezas del álbum tienen que ser de este usuario.
  if (!(await recursosSonDelUsuario(usuario.id, { producto_id, media_ids }))) {
    return NextResponse.json({ error: "El producto o las piezas del álbum elegidas no son de tu cuenta." }, { status: 400 });
  }
  const semana = lunesDeLaSemana(fechaBogota(new Date(programada_para)));

  // Tipo de gancho asignado por el código, no por la IA (pedido
  // explícito): rota los 6 tipos dentro de la semana, eligiendo el que
  // menos se haya usado entre las piezas YA creadas de esa misma
  // semana -- así nunca depende del orden en que se generen los guiones.
  const { data: piezasSemana } = await supabaseAdmin.from("publicaciones_organicas").select("gancho_tipo").eq("user_id", usuario.id).eq("semana", semana);
  const ganchoTipo = elegirGanchoTipoMenosUsado((piezasSemana ?? []).map((p) => p.gancho_tipo as string | null));

  const { data: pieza, error: errorInsert } = await supabaseAdmin
    .from("publicaciones_organicas")
    .insert({
      user_id: usuario.id,
      tema: tema?.trim() || null,
      gancho_tipo: ganchoTipo,
      plataforma: "instagram",
      receta_organica,
      programada_para,
      producto_id: producto_id ?? null,
      media_ids: media_ids?.length ? media_ids : null,
      estado: "borrador",
      semana,
    })
    .select("*")
    .single();

  if (errorInsert || !pieza) {
    console.error("Error creando reel manual en /contenido:", errorInsert);
    registrarError({
      origen: "contenido_calendario",
      userId: usuario.id,
      email: emailBusqueda,
      paso: "crear_manual",
      errorMensaje: "No se pudo crear el reel.",
      detalleTecnico: errorInsert?.message ?? "sin pieza devuelta",
    });
    return NextResponse.json({ error: "No se pudo crear el reel en este momento." }, { status: 503 });
  }

  return NextResponse.json({ pieza: pieza as PublicacionOrganica }, { status: 201 });
}
