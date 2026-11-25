import { createHash } from "crypto";

// Conversions API de Meta -- envía desde el SERVIDOR el mismo evento
// que el navegador ya manda por el Pixel, más confiable porque no
// depende de que el bloqueador de anuncios del visitante deje pasar
// fbevents.js. Hoy NO está conectada a ningún flujo real todavía: el
// token se genera en Events Manager → Configuración → Conversions
// API, y se pone como variable de entorno en Coolify (NUNCA en el
// código) -- sin él, enviarEventoCapi no hace nada.
//
// Para activarla cuando llegue el momento: llamar enviarEventoCapi()
// desde los mismos puntos donde hoy se dispara el evento en el
// navegador (TrackerRegistroGoogle.tsx para Google, /api/auth/registro
// para contraseña). Falta además compartir el mismo event_id entre el
// navegador y el servidor para que Meta deduplique -- eso se deja para
// cuando se conecte de verdad, junto con el token.
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2226087528185704";
const META_CAPI_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;

function hashearEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function enviarEventoCapi(params: {
  evento: "CompleteRegistration" | "StartTrial";
  email: string;
  eventId: string;
}): Promise<void> {
  if (!META_CAPI_TOKEN) return;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: params.evento,
            event_time: Math.floor(Date.now() / 1000),
            event_id: params.eventId,
            action_source: "website",
            user_data: { em: [hashearEmail(params.email)] },
          },
        ],
        access_token: META_CAPI_TOKEN,
      }),
    });
  } catch (err) {
    console.error(`Error enviando evento ${params.evento} a Conversions API:`, err);
  }
}

// Lead de /clase (25 nov 2026): el toque en "Unirme gratis" llega a
// /clase/unirse, que redirige al grupo y manda este evento desde el
// servidor con el MISMO event_id que el navegador usó en fbq (Meta
// deduplica). Sin META_CAPI_ACCESS_TOKEN no hace nada. Nunca lanza: si
// Meta falla o tarda, solo se registra en el log.
export function metaCapiActivo(): boolean {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN);
}

export type DatosLeadCapi = {
  eventId: string;
  urlOrigen: string;
  contentName: string;
  ip: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
};

export function cuerpoLeadCapi(d: DatosLeadCapi, ahoraMs = Date.now()) {
  const user_data: Record<string, string> = {};
  if (d.ip) user_data.client_ip_address = d.ip;
  if (d.userAgent) user_data.client_user_agent = d.userAgent;
  if (d.fbp) user_data.fbp = d.fbp;
  if (d.fbc) user_data.fbc = d.fbc;
  return {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(ahoraMs / 1000),
        event_id: d.eventId,
        action_source: "website",
        event_source_url: d.urlOrigen,
        user_data,
        custom_data: { content_name: d.contentName },
      },
    ],
    // Para verlo en "Probar eventos" del Administrador de eventos (opcional).
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  };
}

export async function enviarLeadCapi(d: DatosLeadCapi): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) return;
  try {
    // El token va en el cuerpo (como enviarEventoCapi), nunca en la URL:
    // así no aparece en ningún log de error.
    const res = await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cuerpoLeadCapi(d), access_token: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`Conversions API respondió ${res.status} al Lead de /clase:`, (await res.text()).slice(0, 300));
  } catch (err) {
    console.error("Error enviando el Lead de /clase a Conversions API:", err);
  }
}
