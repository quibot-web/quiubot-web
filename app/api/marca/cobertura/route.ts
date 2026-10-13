import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data } = await supabaseAdmin
    .from("marcas")
    .select("ciudades_cobertura, pais_cobertura, ciudades_cobertura_meta")
    .eq("email", emailBusqueda)
    .maybeSingle();

  return NextResponse.json({
    ciudades_cobertura: data?.ciudades_cobertura || [],
    // Colombia como valor por defecto -- preserva el comportamiento de
    // siempre para usuarios que ya tenian ciudades guardadas antes de que
    // existiera el selector de pais.
    pais_cobertura: data?.pais_cobertura || "CO",
    // Subconjunto de ciudades_cobertura que SÍ tienen código de Meta (las
    // elegidas con el buscador) -- las viejas (texto a mano, de antes del
    // buscador) quedan en ciudades_cobertura pero no acá.
    ciudades_cobertura_meta: data?.ciudades_cobertura_meta || [],
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { ciudades_cobertura, pais_cobertura, ciudades_cobertura_meta } = await req.json();

  if (!Array.isArray(ciudades_cobertura)) {
    return NextResponse.json({ error: "ciudades_cobertura debe ser una lista" }, { status: 400 });
  }
  if (typeof pais_cobertura !== "string" || pais_cobertura.trim().length !== 2) {
    return NextResponse.json({ error: "pais_cobertura debe ser un codigo de 2 letras (ej. CO, MX, US)" }, { status: 400 });
  }
  // ciudades_cobertura_meta es opcional -- las ciudades viejas (guardadas
  // antes del buscador) no mandan este campo, y eso es válido.
  if (ciudades_cobertura_meta !== undefined && !Array.isArray(ciudades_cobertura_meta)) {
    return NextResponse.json({ error: "ciudades_cobertura_meta debe ser una lista" }, { status: 400 });
  }

  // Limpia espacios y descarta vacíos -- una lista vacía es válida (equivale
  // a "sin restricción de ciudad, nacional en el país elegido").
  const limpio = ciudades_cobertura
    .map((c: unknown) => String(c).trim())
    .filter((c: string) => c.length > 0)
    .slice(0, 20); // techo razonable, evita listas absurdamente largas

  // Mismo techo de 20 -- siempre es un subconjunto de "limpio" (solo las
  // que sí tienen código de Meta), nunca más largo que esa lista.
  const metaLimpio = Array.isArray(ciudades_cobertura_meta)
    ? ciudades_cobertura_meta
        .filter((m: any) => m && typeof m.key === "string" && typeof m.name === "string")
        .map((m: any) => ({ key: m.key, name: m.name, region: typeof m.region === "string" ? m.region : null }))
        .slice(0, 20)
    : [];

  const paisLimpio = pais_cobertura.trim().toUpperCase();

  // Si el usuario todavía no tiene fila en "marcas" (no ha llegado a
  // sintetizar su ADN), la creamos con solo estos campos -- el resto de
  // columnas de marca se completan después, en su propio flujo.
  const { error } = await supabaseAdmin
    .from("marcas")
    .upsert(
      { email: emailBusqueda, ciudades_cobertura: limpio, pais_cobertura: paisLimpio, ciudades_cobertura_meta: metaLimpio },
      { onConflict: "email" }
    );

  if (error) {
    console.error("Error al guardar cobertura:", error);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ciudades_cobertura: limpio, pais_cobertura: paisLimpio, ciudades_cobertura_meta: metaLimpio });
}