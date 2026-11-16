import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { desencriptarSiHaceFalta } from "@/lib/crypto";
import { MODELO_ANALISIS_IMAGEN } from "@/app/lib/analizarPiezaImagen";

// Fase B v2.0, paso 7 del plan -- el paso de visión del control de
// calidad (código + visión, nunca solo uno). Verificado antes con un
// spike descartable (3 cuadros reales, una sola petición a gpt-4o con
// varias image_url + response_format json_object) que esto funciona:
// el modelo distinguió cada cuadro y devolvió un hallazgo por imagen.
// Mismo modelo que ya usa analizarPiezaConOpenAI (MODELO_ANALISIS_IMAGEN,
// "gpt-4o") -- no uno nuevo.
const TIMEOUT_OPENAI_MS = 90_000;
const MAX_CUADROS = 12;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const emailBusqueda = session.user.email.trim().toLowerCase();

  const { data: usuario } = await supabaseAdmin.from("usuarios").select("rol, openai_key").eq("email", emailBusqueda).single();
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!usuario.openai_key) return NextResponse.json({ error: "Conecta tu cuenta de OpenAI en Integraciones." }, { status: 400 });

  let apiKey: string;
  try {
    apiKey = desencriptarSiHaceFalta(usuario.openai_key);
  } catch {
    return NextResponse.json({ error: "No se pudo leer tu llave de OpenAI guardada." }, { status: 500 });
  }

  const cuerpo = await req.json().catch(() => null);
  const cuadros = cuerpo?.cuadros as { etiqueta: string; dataUrl: string }[] | undefined;
  if (!Array.isArray(cuadros) || cuadros.length === 0) {
    return NextResponse.json({ error: "No se mandó ningún cuadro para revisar." }, { status: 400 });
  }
  if (cuadros.length > MAX_CUADROS) {
    return NextResponse.json({ error: `Demasiados cuadros (máx. ${MAX_CUADROS}).` }, { status: 400 });
  }
  for (const c of cuadros) {
    if (typeof c?.etiqueta !== "string" || typeof c?.dataUrl !== "string" || !c.dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Cada cuadro necesita 'etiqueta' y un 'dataUrl' de imagen." }, { status: 400 });
    }
  }

  const content: unknown[] = [
    {
      type: "text",
      text:
        "Te muestro varios cuadros clave de un reel vertical (9:16) de Instagram, cada uno etiquetado con su número de cuadro ANTES de la imagen correspondiente. Para CADA cuadro, revisa: (1) pantalla_vacia -- si más del 40% de la pantalla no tiene ningún elemento visual real (color de fondo liso no cuenta como vacío si el resto del cuadro tiene contenido); (2) texto_superpuesto -- si dos textos o un texto y un elemento gráfico se superponen de forma que alguno se vuelve ilegible; (3) contraste_bajo -- si algún texto se ve difícil de leer contra su fondo. Sé estricto: cualquier superposición real cuenta, aunque sea parcial. Responde ÚNICAMENTE con este JSON, un objeto por cuadro recibido, en el mismo orden: {\"hallazgos\": [{\"cuadro\": \"<etiqueta>\", \"pantalla_vacia\": bool, \"texto_superpuesto\": bool, \"contraste_bajo\": bool, \"nota\": \"string corta, en español, explicando qué viste\"}]}",
    },
  ];
  for (const c of cuadros) {
    content.push({ type: "text", text: `Cuadro ${c.etiqueta}:` });
    content.push({ type: "image_url", image_url: { url: c.dataUrl } });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_OPENAI_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELO_ANALISIS_IMAGEN,
        messages: [{ role: "user", content }],
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text();
      if (/insufficient_quota|credit_balance_exhausted/.test(detalle)) {
        return NextResponse.json({ error: "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar." }, { status: 503 });
      }
      throw new Error(`Error de OpenAI (${res.status}): ${detalle}`);
    }
    const data = await res.json();
    const contenido = data?.choices?.[0]?.message?.content;
    if (typeof contenido !== "string") throw new Error("OpenAI no devolvió contenido de texto.");

    const crudo = JSON.parse(contenido);
    const hallazgos = crudo?.hallazgos;
    if (!Array.isArray(hallazgos)) {
      return NextResponse.json({ error: "La respuesta de control de calidad no tuvo el formato esperado." }, { status: 502 });
    }

    return NextResponse.json({ hallazgos });
  } catch (err) {
    console.error("Error en control de calidad por visión:", err);
    return NextResponse.json({ error: "No se pudo correr el control de calidad por visión." }, { status: 503 });
  } finally {
    clearTimeout(timeoutId);
  }
}
