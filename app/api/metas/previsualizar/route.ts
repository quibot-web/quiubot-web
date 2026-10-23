import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { calcularCostoReferencia, type TipoMeta } from "@/app/lib/metas";
import { tieneAutopiloto } from "@/app/lib/planesConfig";

const TIPOS_VALIDOS: TipoMeta[] = ["conversaciones_whatsapp", "leads"];

// Chequeo de realismo del paso 4 del wizard, sin crear nada todavía --
// compara lo que implica el presupuesto/cantidad elegidos contra el
// costo de referencia (ver calcularCostoReferencia), y sugiere tanto un
// ajuste de meta como de presupuesto. Nunca bloquea: el cliente decide.
const UMBRAL_REALISMO = 0.7;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, rol, plan, en_trial, trial_termina_en, fecha_vencimiento, beta_autopiloto")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!tieneAutopiloto(usuario)) {
    return NextResponse.json({ error: "Autopiloto todavía no está disponible." }, { status: 403 });
  }

  const { tipo, cantidad_objetivo, presupuesto_maximo_cop } = await req.json();

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de meta inválido." }, { status: 400 });
  }
  const cantidad = Number(cantidad_objetivo);
  const presupuesto = Number(presupuesto_maximo_cop);
  if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(presupuesto) || presupuesto <= 0) {
    return NextResponse.json({ error: "Cantidad y presupuesto deben ser mayores a cero." }, { status: 400 });
  }

  const costoObjetivoCop = presupuesto / cantidad;

  let costoReferencia;
  try {
    costoReferencia = await calcularCostoReferencia(tipo, usuario.id);
  } catch (err) {
    console.error("Error calculando el costo de referencia:", err);
    return NextResponse.json({ error: "No se pudo calcular el costo de referencia en este momento." }, { status: 500 });
  }

  const realista = costoReferencia.valorCop <= 0 || costoObjetivoCop >= costoReferencia.valorCop * UMBRAL_REALISMO;

  return NextResponse.json({
    costoObjetivoCop,
    costoReferencia,
    realista,
    cantidadRealista: costoReferencia.valorCop > 0 ? Math.round(presupuesto / costoReferencia.valorCop) : cantidad,
    presupuestoRealista: Math.round(cantidad * costoReferencia.valorCop),
  });
}
