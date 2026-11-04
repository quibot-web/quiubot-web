// Chequeo de vinculación de Instagram -- movido de
// app/api/meta/instagram/salud/route.ts (que ahora delega acá) para
// poder reusarlo server-side desde verificarRequisitosMeta()
// (app/lib/metas.ts), igual que metaPixelSalud.ts.
import { esErrorTokenMetaVencido } from "@/app/lib/metaErrors";

export type SaludInstagram = {
  conectado: boolean;
  username: string | null;
  followers_count: number | null;
  // Distinto de "nunca vinculado" -- antes POST /api/metas sí distinguía
  // esto (mostraba MENSAJE_META_TOKEN_VENCIDO) pero /api/meta/instagram/salud
  // nunca lo chequeó, tratando un token vencido igual que "no vinculado".
  // Se agrega acá para que verificarRequisitosMeta() pueda mostrar el
  // mensaje correcto sin perder esa distinción.
  tokenVencido: boolean;
};

export type UsuarioMetaInstagram = {
  meta_page_id: string | null;
  meta_access_token: string | null;
};

// ¿Tiene una cuenta de Instagram profesional vinculada a su página de
// Facebook? Lo usa /metas/crear para decidir si ofrece seguidores_instagram
// (no se puede fotografiar lo que no existe), igual que metaPixelSalud.ts
// decide si ofrece ventas_web.
export async function obtenerSaludInstagram(usuario: UsuarioMetaInstagram): Promise<SaludInstagram> {
  if (!usuario.meta_page_id || !usuario.meta_access_token) {
    return { conectado: false, username: null, followers_count: null, tokenVencido: false };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${usuario.meta_page_id}?fields=instagram_business_account{username,followers_count}&access_token=${usuario.meta_access_token}`
    );
    const data = await res.json();
    if (esErrorTokenMetaVencido(data.error)) {
      return { conectado: false, username: null, followers_count: null, tokenVencido: true };
    }
    const ig = data.instagram_business_account;
    if (!ig) {
      return { conectado: false, username: null, followers_count: null, tokenVencido: false };
    }
    return {
      conectado: true,
      username: typeof ig.username === "string" ? ig.username : null,
      followers_count: typeof ig.followers_count === "number" ? ig.followers_count : null,
      tokenVencido: false,
    };
  } catch (err) {
    console.error("Error consultando salud de Instagram:", err);
    return { conectado: false, username: null, followers_count: null, tokenVencido: false };
  }
}
