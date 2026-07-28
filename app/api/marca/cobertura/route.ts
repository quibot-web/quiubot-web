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
    .select("ciudades_cobertura")
    .eq("email", emailBusqueda)
    .maybeSingle();

  return NextResponse.json({ ciudades_cobertura: data?.ciudades_cobertura || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { ciudades_cobertura } = await req.json();

  if (!Array.isArray(ciudades_cobertura)) {
    return NextResponse.json({ error: "ciudades_cobertura debe ser una lista" }, { status: 400 });
  }

  // Limpia espacios y descarta vacíos -- una lista vacía es válida (equivale
  // a "sin restricción, nacional", el mismo comportamiento de siempre).
  const limpio = ciudades_cobertura
    .map((c: unknown) => String(c).trim())
    .filter((c: string) => c.length > 0)
    .slice(0, 20); // techo razonable, evita listas absurdamente largas

  // Si el usuario todavía no tiene fila en "marcas" (no ha llegado a
  // sintetizar su ADN), la creamos con solo este campo -- el resto de
  // columnas de marca se completan después, en su propio flujo.
  const { error } = await supabaseAdmin
    .from("marcas")
    .upsert({ email: emailBusqueda, ciudades_cobertura: limpio }, { onConflict: "email" });

  if (error) {
    console.error("Error al guardar ciudades_cobertura:", error);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ciudades_cobertura: limpio });
}