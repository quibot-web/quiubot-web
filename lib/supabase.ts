import "server-only"
import { createClient } from "@supabase/supabase-js"

// "server-only" hace que este archivo NUNCA pueda importarse desde un componente
// "use client" — si alguien lo intenta por error, el build falla con un mensaje
// claro, en vez de arriesgarse a que la key de servicio viaje hacia el navegador.

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
)