import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";

// Errores conocidos de Meta que YA hemos visto en producción y que no se
// resuelven con codigo -- son pasos que el usuario (o el admin de su
// Pagina de Facebook) tiene que hacer directamente en Meta. En vez de
// mostrarle al usuario el JSON crudo de n8n, se traduce a un mensaje
// claro con una accion sugerida cuando aplica.
const MENSAJES_AMIGABLES: Record<number, { titulo: string; mensaje: string; accionTexto?: string; accionUrl?: string }> = {
  1815089: {
    titulo: "Falta aceptar los Términos de Generación de Leads",
    mensaje: "Tu página de Facebook todavía no ha aceptado los Términos de Servicio de Meta para generación de clientes potenciales. Es un paso único y rápido (menos de 1 minuto) que debe hacer un administrador de esa página.",
    accionTexto: "Aceptar términos en Meta",
    accionUrl: "https://facebook.com/ads/leadgen/tos",
  },
  2923003: {
    titulo: "Tu número de WhatsApp Business está suspendido",
    mensaje: "Meta suspendió el número de WhatsApp Business conectado a esta cuenta. Tienes que resolverlo directamente con el soporte de WhatsApp antes de poder publicar campañas de venta por WhatsApp — esto no depende de Quiubot.",
  },
};

// Los errores de n8n llegan como un string con varios niveles de JSON
// anidados y escapados (axios arma el mensaje como `${status} - ${JSON.stringify(cuerpo)}`,
// y ese cuerpo a su vez es el JSON de error de Meta) -- en vez de intentar
// parsear esa estructura exacta (fragil, cambia segun cuantas capas de
// escapado tenga), se buscan directamente los campos que interesan con
// una expresion regular, que tolera cualquier nivel de escapado.
function extraerDetalleMeta(textoCrudo: string): { paso: string | null; subcode: number | null; mensajeMeta: string | null } {
  let paso: string | null = null;
  try {
    const externo = JSON.parse(textoCrudo);
    paso = externo?.paso ?? null;
  } catch {
    // el texto externo no siempre es JSON valido (a veces n8n devuelve
    // solo texto plano si el fallo ocurrio antes de llegar a un nodo de
    // error formal) -- no pasa nada, sigue sin "paso".
  }

  const subcodeMatch = textoCrudo.match(/error_subcode\\*"?\s*:\s*(\d+)/);
  const mensajeMatch = textoCrudo.match(/error_user_msg\\*"?\s*:\s*\\*"([^"\\]*(?:\\.[^"\\]*)*)/);
  let mensajeMeta: string | null = null;
  if (mensajeMatch) {
    mensajeMeta = mensajeMatch[1]
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\\/g, "\\");
  }
  return {
    paso,
    subcode: subcodeMatch ? parseInt(subcodeMatch[1], 10) : null,
    mensajeMeta,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { estrategia, creativos, fuente_creativos, efectividad_final, meta_id } = await req.json();

  if (!estrategia) {
    return NextResponse.json({ error: "Falta la estrategia a publicar" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("email", emailBusqueda)
    .single();

  try {
    const n8nRes = await fetch("https://n8n.quiubot.site/webhook/publicar_estrategia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        estrategia,
        creativos,
        fuente_creativos,
        efectividad_final,
      }),
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text();
      console.error("Error al publicar estrategia (n8n respondió no-ok):", text);

      let paso: string | null = null;
      let subcode: number | null = null;
      let tituloAmigable: string | null = null;
      let accionTexto: string | null = null;
      let accionUrl: string | null = null;
      let mensajeFinal: string;
      let metaCampaignId: string | null = null;
      let anunciosFallidos: unknown = null;

      // Formato nuevo de publicar_estrategia (ej. paso "crear_anuncios"):
      // JSON con ok:false y un error ya legible -- se usa tal cual, sin
      // pasar por extraerDetalleMeta (que es para el formato viejo, errores
      // de Meta anidados en texto). Para cualquier otra cosa (no es JSON,
      // o no trae ok:false + error string) se conserva la lógica de
      // siempre.
      let parseado: any = null;
      try {
        parseado = JSON.parse(text);
      } catch {
        parseado = null;
      }

      if (parseado && parseado.ok === false && typeof parseado.error === "string") {
        paso = typeof parseado.paso === "string" ? parseado.paso : null;
        metaCampaignId = typeof parseado.meta_campaign_id === "string" ? parseado.meta_campaign_id : null;
        anunciosFallidos = Array.isArray(parseado.anuncios_fallidos) ? parseado.anuncios_fallidos : null;
        mensajeFinal = parseado.error;
        if (paso === "crear_anuncios") {
          // El error genérico de n8n ("No se pudieron crear los
          // anuncios") no sirve para diagnosticar nada -- si viene el
          // detalle real de Meta en anuncios_fallidos, se muestra ese tal
          // cual (el primero, que suele ser representativo de todos). Si
          // no viene ninguno, es porque no se llegó a intentar crear ni
          // un anuncio.
          const primerFallido = Array.isArray(anunciosFallidos) && anunciosFallidos.length > 0 ? (anunciosFallidos[0] as any) : null;
          mensajeFinal = primerFallido?.error
            ? primerFallido.titulo
              ? `"${primerFallido.titulo}": ${primerFallido.error}`
              : primerFallido.error
            : "No se envió ningún anuncio a Meta (revisa los creativos).";
          mensajeFinal +=
            " La campaña quedó creada en tu cuenta de Meta pero sin anuncios, así que no está gastando dinero — puedes eliminarla desde el Administrador de anuncios antes de volver a intentar.";
        }
      } else {
        const detalle = extraerDetalleMeta(text);
        paso = detalle.paso;
        subcode = detalle.subcode;
        const amigable = subcode ? MENSAJES_AMIGABLES[subcode] : null;
        tituloAmigable = amigable?.titulo ?? null;
        accionTexto = amigable?.accionTexto ?? null;
        accionUrl = amigable?.accionUrl ?? null;
        // Nunca se manda el texto/JSON crudo al usuario -- si no hay un
        // mensaje amigable conocido, mensaje genérico. El texto crudo queda
        // solo en el console.error de arriba y en detalleTecnico (admin).
        mensajeFinal =
          amigable?.mensaje || detalle.mensajeMeta || "No se pudo publicar la estrategia en Meta. Intenta de nuevo en unos minutos.";
      }

      // Registro central: guarda en errores_publicacion Y notifica a los
      // contactos de admin -- una sola llamada, reutilizable desde
      // cualquier endpoint de Quiubot. meta_campaign_id y anuncios_fallidos
      // van en detalleTecnico (no hay un campo propio para ellos) para que
      // el admin pueda diagnosticar sin tener que ir a buscar el texto
      // crudo en los logs del servidor.
      registrarError({
        origen: "publicar_estrategia",
        userId: usuario?.id ?? null,
        email: emailBusqueda,
        paso,
        errorSubcode: subcode,
        errorTitulo: tituloAmigable,
        errorMensaje: mensajeFinal,
        detalleTecnico: JSON.stringify({ meta_campaign_id: metaCampaignId, anuncios_fallidos: anunciosFallidos, raw: text }),
        campanaNombre: estrategia?.campana?.nombre ?? null,
        objetivoId: estrategia?.campana?.objetivo_id ?? null,
      });

      return NextResponse.json(
        {
          error: mensajeFinal,
          error_titulo: tituloAmigable,
          error_accion_texto: accionTexto,
          error_accion_url: accionUrl,
        },
        { status: n8nRes.status || 502 }
      );
    }

    const data = await n8nRes.json().catch(() => ({}));

    // Registrar la campaña en nuestra BD para poder monitorearla luego
    if (usuario) {
      // meta_id llega del cliente (?meta_id= de /estrategia, ver ese
      // archivo) -- se valida que de verdad sea una meta de este mismo
      // usuario antes de confiar en ella, para que nadie pueda ligar su
      // campaña nueva a la meta de otra cuenta solo editando el body.
      let metaIdValidado: string | null = null;
      if (typeof meta_id === "string" && meta_id) {
        const { data: metaDelUsuario } = await supabaseAdmin
          .from("metas")
          .select("id")
          .eq("id", meta_id)
          .eq("user_id", usuario.id)
          .maybeSingle();
        metaIdValidado = metaDelUsuario?.id ?? null;
      }

      const { data: campana, error: insertError } = await supabaseAdmin
        .from("campanas_publicadas")
        .insert({
          user_id: usuario.id,
          nombre: estrategia?.campana?.nombre ?? "Campaña sin nombre",
          objetivo: estrategia?.campana?.objetivo_meta ?? null,
          objetivo_id: estrategia?.campana?.objetivo_id ?? null,
          presupuesto_diario: estrategia?.campana?.presupuesto_diario_cop ?? null,
          efectividad_estimada: efectividad_final ?? estrategia?.efectividad ?? null,
          estado: "activa",
          meta_campaign_id: data?.meta_campaign_id ?? null,
          meta_adset_id: data?.meta_adset_id ?? null,
          meta_id: metaIdValidado,
        })
        .select()
        .single();

      if (!insertError && campana) {
        await supabaseAdmin.from("notificaciones").insert({
          user_id: usuario.id,
          campana_id: campana.id,
          tipo: "campana_publicada",
          titulo: "Campaña publicada",
          mensaje: `Tu campaña "${campana.nombre}" fue publicada correctamente en Meta.`,
          estado: "pendiente",
        });
      }
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("Error al publicar estrategia:", err);

    registrarError({
      origen: "publicar_estrategia",
      userId: usuario?.id ?? null,
      email: emailBusqueda,
      paso: "conexion_con_n8n",
      errorMensaje: "No se pudo conectar con n8n",
      detalleTecnico: String(err),
      campanaNombre: estrategia?.campana?.nombre ?? null,
      objetivoId: estrategia?.campana?.objetivo_id ?? null,
    });

    return NextResponse.json({ error: "No se pudo conectar con n8n" }, { status: 503 });
  }
}