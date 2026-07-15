import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PLANES, type PlanId } from "@/app/lib/planesConfig";
import { desencriptarSiHaceFalta } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const emailBusqueda = session.user.email.trim().toLowerCase();
  const { imagen_base64, objetivo, presupuesto_diario_cop } = await req.json();

  if (!imagen_base64 || !objetivo) {
    return NextResponse.json({ error: "Falta la imagen o el objetivo publicitario" }, { status: 400 });
  }

  if (!presupuesto_diario_cop || presupuesto_diario_cop < 20000) {
    return NextResponse.json({ error: "El presupuesto diario mínimo es $20.000 COP" }, { status: 400 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, plan, openai_key")
    .eq("email", emailBusqueda)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!usuario.openai_key) {
    return NextResponse.json(
      { error: "Necesitas conectar tu API key de OpenAI en Integraciones antes de generar una estrategia." },
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

  const plan = (usuario.plan as PlanId) || "arranque";
  const limite = PLANES[plan].estrategiasPorMes;

  if (limite !== null) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("estrategias_generadas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", usuario.id)
      .gte("creado_en", inicioMes.toISOString());

    if ((count ?? 0) >= limite) {
      return NextResponse.json(
        {
          error: `Ya usaste tus ${limite} estrategia${limite > 1 ? "s" : ""} de este mes en el plan ${PLANES[plan].nombre}. Mejora tu plan para seguir generando, o espera al próximo mes.`,
          limite_alcanzado: true,
        },
        { status: 403 }
      );
    }
  }

  try {
    const n8nRes = await fetch("https://n8n.quibot.juanshow.cloud/webhook/generar_estrategia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailBusqueda,
        imagen_base64,
        objetivo,
        presupuesto_diario_cop,
        openai_key: openaiKeyDescifrada,
      }),
    });

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || data.ok === false) {
      return NextResponse.json(
        { error: data.error || "No se pudo generar la estrategia" },
        { status: n8nRes.status || 502 }
      );
    }

    await supabaseAdmin.from("estrategias_generadas").insert({ user_id: usuario.id });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error al conectar con n8n (generar_estrategia):", err);
    return NextResponse.json({ error: "No se pudo conectar con el servidor de IA" }, { status: 503 });
  }
}