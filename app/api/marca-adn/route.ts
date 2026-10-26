import { auth } from "@/auth";
import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { procesarAdnMarca, TIPO_TRABAJO } from "@/app/lib/adnMarcaJobs";

const MIN_IMAGENES = 3;
const MAX_IMAGENES = 5;

// Consulta si el usuario ya tiene un ADN de marca generado.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data } = await supabaseAdmin
    .from("marcas")
    .select("adn_marca, adn_resumen, adn_generado_en, nombre_marca, logo_url")
    .eq("email", emailBusqueda)
    .maybeSingle();

  return NextResponse.json({
    tieneAdn: !!data?.adn_marca,
    adn_marca: data?.adn_marca ?? null,
    adn_resumen: data?.adn_resumen ?? null,
    adn_generado_en: data?.adn_generado_en ?? null,
    // Para el encabezado de cada tarjeta en ElegirEstrategia ("Tu
    // página" con el nombre/foto reales en vez del genérico) -- ver
    // app/estrategia/page.tsx, donde esta misma llamada ya se hacía.
    nombre_marca: data?.nombre_marca ?? null,
    logo_url: data?.logo_url ?? null,
  });
}

// Dispara el análisis de ADN de marca con 3 a 5 imágenes de creativos ya
// existentes -- en segundo plano (trabajos_ia, ver app/lib/adnMarcaJobs.ts)
// en vez de esperar la respuesta de n8n dentro del ciclo de esta
// petición: el proxy de Coolify corta la conexión antes de que n8n
// termine, y mata con ella el trabajo del lado del servidor. El
// cliente (app/marca/page.tsx) hace polling de
// GET /api/marca-adn-jobs/[id] hasta que quede "lista" o "fallida".
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { imagenes_base64 } = await req.json();

  if (!Array.isArray(imagenes_base64) || imagenes_base64.length < MIN_IMAGENES) {
    return NextResponse.json(
      { error: `Necesitas subir al menos ${MIN_IMAGENES} creativos para analizar tu ADN de marca.` },
      { status: 400 }
    );
  }

  const imagenesFinal = imagenes_base64.slice(0, MAX_IMAGENES);

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de analizar tu ADN de marca." },
      { status: 400 }
    );
  }

  let openaiKeyDescifrada: string;
  try {
    openaiKeyDescifrada = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key:", err);
    return NextResponse.json(
      { error: "No se pudo leer tu API key guardada. Vuelve a conectarla en Integraciones." },
      { status: 500 }
    );
  }

  const ahora = new Date().toISOString();
  const { data: job, error: errorCrearJob } = await supabaseAdmin
    .from("trabajos_ia")
    .insert({ user_id: usuario.id, tipo: TIPO_TRABAJO, estado: "pendiente", intento_desde: ahora })
    .select()
    .single();

  if (errorCrearJob || !job) {
    console.error("Error creando trabajos_ia (adn_marca):", errorCrearJob);
    return NextResponse.json({ error: "No se pudo iniciar el análisis. Intenta de nuevo." }, { status: 500 });
  }

  after(() =>
    procesarAdnMarca(job.id, {
      emailBusqueda,
      openaiKey: openaiKeyDescifrada,
      imagenesBase64: imagenesFinal,
    }).catch(async (err) => {
      console.error("Error no manejado en procesarAdnMarca:", err);
      await supabaseAdmin
        .from("trabajos_ia")
        .update({ estado: "fallida", error: "Error inesperado analizando el ADN de marca." })
        .eq("id", job.id);
    })
  );

  return NextResponse.json({ job_id: job.id });
}