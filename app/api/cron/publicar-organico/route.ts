import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ejecutarPublicadorOrganico } from "@/app/lib/publicadorOrganico";
import { registrarError } from "@/lib/registrarError";

// Publicador automático de reels orgánicos a Instagram (paso 4 de la
// integración de Fase B v2.0, ver app/lib/publicadorOrganico.ts y
// docs/diseno/plan_contenido_organico.md sección 7). Llamado cada 5
// min por un Schedule Trigger en n8n, mismo Bearer ADMIN_SECRET +
// timingSafeEqual que el resto de los crons.
//
// Staging y producción comparten base de datos: esta ruta solo actúa
// si PUBLICADOR_ORGANICO_ACTIVO === "true" en ESE despliegue. En
// cualquier otro caso responde 200 sin leer ni escribir nada, así que
// el mismo cron apuntando a un despliegue sin la variable es inofensivo.
// Nunca encender la variable en los dos a la vez (la RPC atómica evita
// publicar dos veces, pero dos publicadores compitiendo complican
// cualquier diagnóstico).
//
// Todo se espera dentro de la petición (sin after()): cada vuelta hace
// a lo sumo ~10 piezas por paso, con llamadas cortas a Meta -- el
// procesamiento del video en Meta se espera ENTRE vueltas, no acá.
function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("ADMIN_SECRET no configurado.");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization") || "";
  if (!compararSeguro(authHeader, `Bearer ${adminSecret}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (process.env.PUBLICADOR_ORGANICO_ACTIVO !== "true") {
    return NextResponse.json({ ok: true, activo: false });
  }

  try {
    const resumen = await ejecutarPublicadorOrganico();
    return NextResponse.json({ ok: true, activo: true, ...resumen });
  } catch (err) {
    console.error("Error inesperado en el publicador orgánico:", err);
    await registrarError({
      origen: "publicador_organico",
      email: null,
      paso: "cron",
      errorMensaje: "El publicador automático falló en esta vuelta.",
      detalleTecnico: String(err),
    });
    return NextResponse.json({ error: "El publicador falló en esta vuelta." }, { status: 500 });
  }
}
