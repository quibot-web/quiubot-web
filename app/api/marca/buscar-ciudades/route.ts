import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

// Busca ciudades reales de Meta (mismo catálogo que usa el Administrador de
// Anuncios) con el token de la APP, no el del usuario -- en /marca puede que
// todavía no haya conectado Meta, y esta búsqueda es catálogo público, no
// datos de ninguna cuenta publicitaria. Devuelve el "key" exacto de Meta
// para que publicar_estrategia (en n8n) no tenga que adivinar el código a
// partir del nombre.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const countryCode = (searchParams.get("country_code") || "").trim().toUpperCase();
  const q = (searchParams.get("q") || "").trim();

  if (countryCode.length !== 2) {
    return NextResponse.json({ error: "Falta country_code (código de 2 letras)" }, { status: 400 });
  }

  // Mínimo 2 caracteres -- menos que eso, Meta devuelve demasiado ruido y
  // no vale la pena gastar la llamada.
  if (q.length < 2) {
    return NextResponse.json({ ciudades: [] });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Falta configurar META_APP_ID/META_APP_SECRET en el servidor." }, { status: 500 });
  }

  try {
    const url = new URL("https://graph.facebook.com/v21.0/search");
    url.searchParams.set("type", "adgeolocation");
    url.searchParams.set("location_types", JSON.stringify(["city"]));
    url.searchParams.set("country_code", countryCode);
    url.searchParams.set("q", q);
    url.searchParams.set("access_token", `${appId}|${appSecret}`);

    const metaRes = await fetch(url.toString());
    const data = await metaRes.json().catch(() => ({}));

    if (!metaRes.ok || data.error) {
      console.error("Error buscando ciudades en Meta:", data.error || data);
      return NextResponse.json({ error: "No se pudo buscar ciudades en este momento." }, { status: 502 });
    }

    // Meta devuelve "neighborhood" (y otros tipos más finos) mezclados aunque
    // se pida location_types=["city"] -- se filtra a mano. También se valida
    // country_code por si acaso, aunque ya se lo mandamos en la query.
    const ciudades = (data.data || [])
      .filter((r: any) => (r.type === "city" || r.type === "subcity") && r.country_code === countryCode)
      .slice(0, 10)
      .map((r: any) => ({ key: r.key, name: r.name, region: r.region || null }));

    return NextResponse.json({ ciudades });
  } catch (err) {
    console.error("Error al conectar con Meta (buscar-ciudades):", err);
    return NextResponse.json({ error: "No se pudo conectar con Meta." }, { status: 503 });
  }
}
