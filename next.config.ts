import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Se aplica a todas las rutas del sitio
        source: "/:path*",
        headers: [
          // Evita que el navegador "adivine" el tipo de un archivo distinto al declarado
          { key: "X-Content-Type-Options", value: "nosniff" },

          // Evita que tu sitio se pueda cargar dentro de un <iframe> de otro sitio
          // (protección contra "clickjacking" — engañar al usuario haciéndolo
          // clickear algo de tu sitio sin que se dé cuenta, camuflado en otra página)
          { key: "X-Frame-Options", value: "DENY" },

          // Controla cuánta información de la URL de origen se envía al navegar a otro sitio
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // Desactiva funciones del navegador que Quiubot no usa (cámara, micrófono,
          // ubicación) — así ninguna parte de la app puede pedirlas ni por error
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },

          // Fuerza HTTPS en el navegador por 2 años, incluidos subdominios
          // (quiubot.site ya está 100% en HTTPS, así que esto es seguro de activar)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },

          // CSP en modo "solo reportar" — revisar la consola en /, /bienvenida, /login
          // y /estrategia. 'unsafe-inline' en script-src es una decisión consciente:
          // un CSP con nonce "perfecto" requeriría forzar renderizado dinámico en varias
          // páginas y activarlo en modo bloqueo desde el inicio (Next.js no aplica nonces
          // en modo "solo reportar" — limitación conocida del framework), un riesgo
          // desproporcionado sin una vulnerabilidad de XSS identificada hoy.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co https://accounts.google.com",
              "frame-src https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;