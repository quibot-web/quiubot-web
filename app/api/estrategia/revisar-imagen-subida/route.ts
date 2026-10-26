import { auth } from "@/auth";
import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { procesarRevisionImagen, TIPO_TRABAJO } from "@/app/lib/revisionImagenJobs";

// "Subir el mío" en el paso de elegir estrategia -- revisa EN SEGUNDO
// PLANO (no bloquea nada) si la imagen que el cliente subió encaja con
// el concepto/copy de ese anuncio puntual. Nunca impide publicar: si
// esto falla o no hay API key, el cliente simplemente no muestra
// sugerencias (ver ElegirEstrategia.tsx).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { url_imagen, conjunto_nombre, anuncio_nombre, titulo, texto, descripcion, cta, concepto, campana } = await req.json();

  if (typeof url_imagen !== "string" || !url_imagen) {
    return NextResponse.json({ error: "Falta la imagen a revisar" }, { status: 400 });
  }
  if (typeof conjunto_nombre !== "string" || typeof anuncio_nombre !== "string" || !conjunto_nombre || !anuncio_nombre) {
    return NextResponse.json({ error: "Falta el anuncio a revisar" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!usuario.openai_key) {
    return NextResponse.json({ error: "Necesitas conectar tu API key de OpenAI para revisar imágenes." }, { status: 400 });
  }

  let openaiKeyDescifrada: string;
  try {
    openaiKeyDescifrada = desencriptarSiHaceFalta(usuario.openai_key);
  } catch (err) {
    console.error("Error al descifrar openai_key:", err);
    return NextResponse.json({ error: "No se pudo leer tu API key guardada." }, { status: 500 });
  }

  // "estrategia" mini -- analizar_creativos_album espera ese shape
  // completo (conjuntos[].anuncios[].copy/concepto), pero acá solo hace
  // falta el UN anuncio puntual que se está revisando, no la estrategia
  // entera (ya la tiene el cliente, y mandarla completa filtraría datos
  // de otros anuncios sin necesidad).
  const estrategiaMini = {
    campana: campana ?? null,
    conjuntos: [
      {
        nombre: conjunto_nombre,
        anuncios: [
          {
            nombre: anuncio_nombre,
            copy: { titulo: titulo || "", texto: texto || "", descripcion: descripcion || "", cta: cta || "" },
            concepto: concepto ?? null,
          },
        ],
      },
    ],
  };

  const creativoAlbum = {
    id: `subida_${conjunto_nombre}_${anuncio_nombre}`,
    tipo: "imagen",
    origen: "subida",
    url_imagen,
    titulo: titulo || "",
    texto: texto || "",
    descripcion: descripcion || "",
    cta: cta || "",
    conjunto_nombre,
    anuncio_nombre,
    concepto: concepto ?? null,
  };

  const ahora = new Date().toISOString();
  const { data: job, error: errorCrearJob } = await supabaseAdmin
    .from("trabajos_ia")
    .insert({ user_id: usuario.id, tipo: TIPO_TRABAJO, estado: "pendiente", intento_desde: ahora })
    .select()
    .single();

  if (errorCrearJob || !job) {
    console.error("Error creando trabajos_ia (revision_imagen):", errorCrearJob);
    return NextResponse.json({ error: "No se pudo iniciar la revisión." }, { status: 500 });
  }

  after(() =>
    procesarRevisionImagen(job.id, {
      emailBusqueda,
      openaiKey: openaiKeyDescifrada,
      estrategiaMini,
      creativoAlbum,
    }).catch(async (err) => {
      console.error("Error no manejado en procesarRevisionImagen:", err);
      await supabaseAdmin
        .from("trabajos_ia")
        .update({ estado: "fallida", error: "Error inesperado revisando la imagen." })
        .eq("id", job.id);
    })
  );

  return NextResponse.json({ job_id: job.id });
}
