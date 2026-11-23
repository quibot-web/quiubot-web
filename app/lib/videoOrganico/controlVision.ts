import { MODELO_ANALISIS_IMAGEN } from "@/app/lib/analizarPiezaImagen";
import { promptControlIlustrado } from "@/app/lib/videoOrganico/controlCalidadIlustrado";
import { errorDeOpenAI, respuestaErrorOpenAI } from "@/app/lib/openaiErrores";

// Paso de visión del control de calidad (código + visión, nunca solo
// uno). Extraído de /api/admin/reel-automatico-prueba/control-calidad
// (lanzamiento 30 nov 2026) para que /contenido lo use desde su propia
// ruta con permiso de dueño (/api/contenido/[id]/control-calidad) y el
// arnés admin siga con la suya. Mismo modelo que analizarPiezaConOpenAI
// (MODELO_ANALISIS_IMAGEN). Siempre con la llave de OpenAI del usuario.
const TIMEOUT_OPENAI_MS = 90_000;
const MAX_CUADROS = 12;

export async function correrControlVision(apiKey: string, cuerpo: { cuadros?: unknown; tipo?: unknown } | null): Promise<{ cuerpo: Record<string, unknown>; status: number }> {
  const cuadros = (cuerpo?.cuadros as unknown) as { etiqueta: string; dataUrl: string }[] | undefined;
  if (!Array.isArray(cuadros) || cuadros.length === 0) {
    return { cuerpo: { error: "No se mandó ningún cuadro para revisar." }, status: 400 };
  }
  if (cuadros.length > MAX_CUADROS) {
    return { cuerpo: { error: `Demasiados cuadros (máx. ${MAX_CUADROS}).` }, status: 400 };
  }
  for (const c of cuadros) {
    if (typeof c?.etiqueta !== "string" || typeof c?.dataUrl !== "string" || !c.dataUrl.startsWith("data:image/")) {
      return { cuerpo: { error: "Cada cuadro necesita 'etiqueta' y un 'dataUrl' de imagen." }, status: 400 };
    }
  }

  // Reel ilustrado: prompt propio (ver controlCalidadIlustrado.ts), con
  // lo que DEBERÍA verse en cada cuadro.
  const esIlustrado = cuerpo?.tipo === "ilustrado";
  if (esIlustrado && cuadros.some((c) => typeof (c as { esperado?: unknown }).esperado !== "string")) {
    return { cuerpo: { error: "En el reel ilustrado cada cuadro necesita 'esperado'." }, status: 400 };
  }
  const content: unknown[] = esIlustrado
    ? [{ type: "text", text: promptControlIlustrado(cuadros as unknown as { etiqueta: string; esperado: string }[]) }]
    : [
    {
      type: "text",
      text:
        "Te muestro varios cuadros clave de un reel vertical (9:16) de Instagram, cada uno etiquetado con su número de cuadro ANTES de la imagen correspondiente. Para CADA cuadro, revisa: (1) pantalla_vacia -- si más del 40% de la pantalla no tiene ningún elemento visual real (color de fondo liso no cuenta como vacío si el resto del cuadro tiene contenido); (2) texto_superpuesto -- SOLO si un texto o elemento gráfico de verdad CUBRE a otro, haciendo que alguno de los dos quede parcial o totalmente ilegible (letras cortadas, encimadas o imposibles de leer). Dos bloques de texto separados, aunque estén relativamente cerca uno del otro con un espacio vacío claro entre ambos, NO cuentan como superposición -- eso es diseño normal, no un error; (3) contraste_bajo -- si algún texto se ve difícil de leer contra su fondo. Sé estricto con lo que SÍ es un error real (texto ilegible, cortado o encimado), pero no marques como error una composición que simplemente tiene varios elementos en la misma mitad de la pantalla sin tocarse. Responde ÚNICAMENTE con este JSON, un objeto por cuadro recibido, en el mismo orden: {\"hallazgos\": [{\"cuadro\": \"<etiqueta>\", \"pantalla_vacia\": bool, \"texto_superpuesto\": bool, \"contraste_bajo\": bool, \"nota\": \"string corta, en español, explicando qué viste\"}]}",
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
      const errorOpenAI = errorDeOpenAI(detalle);
      if (errorOpenAI) {
        const r = respuestaErrorOpenAI(errorOpenAI);
        return { cuerpo: r.cuerpo, status: r.status };
      }
      throw new Error(`Error de OpenAI (${res.status}): ${detalle}`);
    }
    const data = await res.json();
    const contenido = data?.choices?.[0]?.message?.content;
    if (typeof contenido !== "string") throw new Error("OpenAI no devolvió contenido de texto.");

    const crudo = JSON.parse(contenido);
    const hallazgos = crudo?.hallazgos;
    if (!Array.isArray(hallazgos)) {
      return { cuerpo: { error: "La respuesta de control de calidad no tuvo el formato esperado." }, status: 502 };
    }

    return { cuerpo: { hallazgos }, status: 200 };
  } catch (err) {
    console.error("Error en control de calidad por visión:", err);
    return { cuerpo: { error: "No se pudo correr el control de calidad por visión." }, status: 503 };
  } finally {
    clearTimeout(timeoutId);
  }
}
