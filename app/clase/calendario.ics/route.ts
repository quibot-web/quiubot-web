import { archivoIcs } from "../evento";

// Archivo .ics de la clase (Apple Calendar, Outlook y cualquier otro
// calendario). Contenido fijo: se genera una sola vez en el build.
export const dynamic = "force-static";

export function GET() {
  return new Response(archivoIcs(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clase-quiubot.ics"',
    },
  });
}
