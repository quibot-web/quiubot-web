import { randomUUID } from "crypto";
import { after, type NextRequest } from "next/server";
import { enviarLeadCapi } from "@/lib/metaCapi";
import { ENLACE_COMUNIDAD } from "../evento";

// /clase/unirse (pública, ver esPaginaClasePublica en middleware.ts): el
// botón "Unirme gratis" pasa por aquí. Redirige al grupo de WhatsApp de
// inmediato y DESPUÉS (after) manda el Lead a Conversions API con el mismo
// event_id que disparó el navegador. Si Meta falla, la redirección ya salió.
export const dynamic = "force-dynamic";

const EVENT_ID_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;

function ipDe(req: NextRequest): string | null {
  const reenviada = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || req.headers.get("x-real-ip") || null;
}

export function GET(req: NextRequest) {
  const eid = req.nextUrl.searchParams.get("eid");
  // Sin eid (sin JavaScript, o lo abrieron directo) igual cuenta: el
  // servidor pone uno propio y no hay nada que deduplicar.
  const eventId = eid && EVENT_ID_VALIDO.test(eid) ? eid : randomUUID();
  const datos = {
    eventId,
    urlOrigen: "https://quiubot.site/clase",
    contentName: "clase_26nov",
    ip: ipDe(req),
    userAgent: req.headers.get("user-agent"),
    fbp: req.cookies.get("_fbp")?.value ?? null,
    fbc: req.cookies.get("_fbc")?.value ?? null,
  };
  try {
    after(() => enviarLeadCapi(datos));
  } catch (err) {
    // Fuera de una petición (no debería pasar): nunca bloquear la redirección.
    console.error("No se pudo programar el Lead de /clase:", err);
  }
  return new Response(null, { status: 302, headers: { Location: ENLACE_COMUNIDAD, "Cache-Control": "no-store" } });
}
