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
