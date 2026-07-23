import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// Este endpoint ya NO maneja el formulario de 11 preguntas (nombre, slogan,
// colores, tono, etc.) — eso se reemplazó por el análisis de ADN de marca
// (ver app/api/marca-adn/route.ts). Lo único que queda aquí es el "destino
// de venta" (sitio web / WhatsApp), que ahora vive como una tarjeta más en
// Integraciones, porque es un dato funcional (a dónde mandar el tráfico de
// los anuncios), no de identidad visual.

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("marcas")
    .select("sitio_web, whatsapp_numero")
    .eq("email", session.user.email.trim().toLowerCase())
    .maybeSingle();

  return NextResponse.json(data ?? { sitio_web: null, whatsapp_numero: null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const bodyCrudo = await req.json();

  // Lista blanca explícita: solo estos 2 campos pueden escribirse desde este
  // endpoint. Nunca hacemos `...body` a ciegas — eso dejaría que alguien
  // mande cualquier columna (incluyendo adn_marca, que solo debe escribir
  // el workflow de n8n) y la sobrescriba desde el navegador.
  const datosPermitidos: { sitio_web?: string | null; whatsapp_numero?: string | null } = {};

  if (typeof bodyCrudo.sitio_web === "string") {
    let url = bodyCrudo.sitio_web.trim();
    if (url === "") {
      datosPermitidos.sitio_web = null;
    } else {
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }
      datosPermitidos.sitio_web = url;
    }
  }

  if (typeof bodyCrudo.whatsapp_numero === "string") {
    const soloDigitos = bodyCrudo.whatsapp_numero.replace(/\D/g, "");
    datosPermitidos.whatsapp_numero = soloDigitos === "" ? null : soloDigitos;
  }

  if (Object.keys(datosPermitidos).length === 0) {
    return NextResponse.json({ error: "No se recibió ningún dato válido para guardar." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("marcas")
    .upsert(
      {
        email: emailBusqueda,
        ...datosPermitidos,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}