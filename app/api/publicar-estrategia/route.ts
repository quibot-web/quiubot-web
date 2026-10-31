import { auth } from "@/auth";
import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { procesarPublicarEstrategia, TIPO_TRABAJO, MENSAJE_SIN_CONFIRMAR } from "@/app/lib/publicarEstrategiaJobs";

// Dispara publicar_estrategia en segundo plano (trabajos_ia, ver
// app/lib/publicarEstrategiaJobs.ts) en vez de esperar la respuesta de
// n8n dentro del ciclo de esta petición -- mismo motivo que crear_creativos/
// generar_estrategia/agregar_anuncios: el proxy de Coolify corta la
// conexión antes de que n8n termine, y publicar_estrategia v10 puede
// tardar hasta ~4 minutos por video (sube a advideos, espera a que Meta
// lo procese). Este endpoint ya no espera nada de Meta: valida, resuelve
// la precondición de Instagram (rápida), y devuelve un job_id para que
// el cliente haga polling en /api/publicar-estrategia-jobs/[id].
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { estrategia, creativos, fuente_creativos, efectividad_final, meta_id, tipo_contenido, descripcion_servicio, datos_producto } = await req.json();

  if (!estrategia) {
    return NextResponse.json({ error: "Falta la estrategia a publicar" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, meta_page_id, meta_access_token")
    .eq("email", emailBusqueda)
    .single();

  // Antes no se validaba esto (el resto del handler toleraba "usuario"
  // nulo) -- ahora sí hace falta de verdad: trabajos_ia.user_id no puede
  // quedar vacío, y sin fila no hay cómo lanzar el trabajo en segundo plano.
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // seguidores_instagram necesita mandarle a n8n QUÉ cuenta de Instagram
  // usar en el creativo (instagram_user_id) -- se lee en caliente en vez
  // de confiar en algo que mandó el cliente, igual que la precondición
  // al crear la meta (ver /api/metas). Esto es rápido (una sola llamada a
  // Graph API), así que se queda en el ciclo de la petición -- no hace
  // falta meterlo en el trabajo en segundo plano.
  const MENSAJE_INSTAGRAM_NO_CONECTADO =
    "Necesitas que tu Instagram profesional esté vinculado a tu página de Facebook y autorizado en tu cuenta publicitaria (Meta Business Manager → Cuentas de Instagram → Conectar activos) antes de publicar con este objetivo.";
  let instagram: { id: string; username: string } | null = null;
  if (estrategia?.campana?.objetivo_id === "seguidores_instagram") {
    if (!usuario.meta_page_id || !usuario.meta_access_token) {
      return NextResponse.json({ error: MENSAJE_INSTAGRAM_NO_CONECTADO }, { status: 400 });
    }
    try {
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${usuario.meta_page_id}?fields=instagram_business_account{id,username}&access_token=${usuario.meta_access_token}`
      );
      const igData = await igRes.json();
      const ig = igData.instagram_business_account;
      if (!ig?.id || !ig?.username) {
        return NextResponse.json({ error: MENSAJE_INSTAGRAM_NO_CONECTADO }, { status: 400 });
      }
      instagram = { id: ig.id, username: ig.username };
    } catch (err) {
      console.error("Error consultando instagram_business_account al publicar:", err);
      return NextResponse.json({ error: "No se pudo verificar tu cuenta de Instagram en este momento." }, { status: 500 });
    }
  }

  // Nada de duplicados: publicar crea campañas reales en Meta, así que
  // dos trabajos corriendo a la vez para la MISMA estrategia publicarían
  // dos veces. Si ya hay uno pendiente/procesando, se devuelve su
  // job_id en vez de crear uno nuevo -- el botón "Publicar" además
  // queda deshabilitado del lado del cliente mientras tanto (ver
  // app/estrategia/page.tsx), esto es el respaldo del lado del servidor.
  const estrategiaId = typeof estrategia?.id === "string" ? estrategia.id : null;
  if (estrategiaId) {
    const { data: existente } = await supabaseAdmin
      .from("trabajos_ia")
      .select("id")
      .eq("tipo", TIPO_TRABAJO)
      .eq("user_id", usuario.id)
      .eq("resultado->>estrategia_id", estrategiaId)
      .in("estado", ["pendiente", "procesando"])
      .maybeSingle();

    if (existente) {
      return NextResponse.json({ job_id: existente.id });
    }
  }

  const ahora = new Date().toISOString();
  const { data: trabajo, error: errorTrabajo } = await supabaseAdmin
    .from("trabajos_ia")
    .insert({
      user_id: usuario.id,
      tipo: TIPO_TRABAJO,
      estado: "pendiente",
      intento_desde: ahora,
      resultado: estrategiaId ? { estrategia_id: estrategiaId } : null,
    })
    .select()
    .single();

  if (errorTrabajo || !trabajo) {
    console.error("Error creando trabajos_ia (publicar_estrategia):", errorTrabajo);
    return NextResponse.json({ error: "No se pudo iniciar la publicación. Intenta de nuevo." }, { status: 500 });
  }

  after(() =>
    procesarPublicarEstrategia(trabajo.id, {
      emailBusqueda,
      userId: usuario.id,
      estrategia,
      creativos,
      fuenteCreativos: fuente_creativos,
      efectividadFinal: efectividad_final,
      instagram,
      metaId: typeof meta_id === "string" ? meta_id : null,
      tipoContenido: tipo_contenido,
      descripcionServicio: typeof descripcion_servicio === "string" ? descripcion_servicio : null,
      datosProducto: typeof datos_producto === "string" ? datos_producto : null,
    }).catch(async (err) => {
      console.error("Error no manejado en procesarPublicarEstrategia:", err);
      await supabaseAdmin.from("trabajos_ia").update({ estado: "fallida", error: MENSAJE_SIN_CONFIRMAR }).eq("id", trabajo.id);
    })
  );

  return NextResponse.json({ job_id: trabajo.id });
}
