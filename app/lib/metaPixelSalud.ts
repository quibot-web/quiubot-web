// Chequeo de salud del pixel de Meta -- movido de
// app/api/meta/pixel/salud/route.ts (que ahora delega acá) para poder
// reusarlo server-side desde verificarRequisitosMeta() (app/lib/metas.ts),
// que antes de este commit solo existía como un chequeo visual en
// app/metas/crear/page.tsx, nunca aplicado en el POST real.
import { esErrorTokenMetaVencido } from "@/app/lib/metaErrors";

// Mismo criterio de prioridad que sync-meta-insights (nunca sumar los
// dos -- omni_purchase puede ya incluir lo que purchase cuenta solo).
const ACCIONES_COMPRA = ["omni_purchase", "purchase"];
const EVENTO_COMPRA_PIXEL = "Purchase";
const MAX_PAGINAS_STATS = 10;

export type SaludPixel = {
  conectado: boolean;
  ultimo_disparo: string | null;
  compras_7d: number;
  compras_con_valor: boolean | null;
};

export type UsuarioMetaPixel = {
  meta_pixel_id: string | null;
  meta_access_token: string | null;
  meta_ad_account_id: string | null;
};

// ¿El pixel está conectado y viendo compras? Fuente principal: los
// disparos reales del propio pixel (/stats), porque a diferencia de los
// insights de la cuenta publicitaria, esos SÍ ven compras orgánicas --
// alguien que nunca pautó para ventas pero ya tiene el pixel instalado
// y recibiendo Purchase en su sitio no debería salir en cero. Los
// insights de la cuenta quedan como respaldo (si /stats falla) y como
// la única forma de confirmar si esas compras traen valor en dinero
// (eso /stats no lo expone).
export async function obtenerSaludPixel(usuario: UsuarioMetaPixel): Promise<SaludPixel> {
  if (!usuario.meta_pixel_id || !usuario.meta_access_token) {
    return { conectado: false, ultimo_disparo: null, compras_7d: 0, compras_con_valor: false };
  }

  // Si el token de Meta ya venció (code 190), ninguna de las llamadas de
  // abajo trae nada real -- sin este chequeo, el "conectado: true" fijo
  // del final mentiría (mostraría el pixel como sano, con compras en
  // cero, en vez de reportar que la conexión está muerta).
  let tokenVencido = false;

  let ultimo_disparo: string | null = null;
  try {
    const resPixel = await fetch(
      `https://graph.facebook.com/v21.0/${usuario.meta_pixel_id}?fields=last_fired_time&access_token=${usuario.meta_access_token}`
    );
    const dataPixel = await resPixel.json();
    if (esErrorTokenMetaVencido(dataPixel.error)) tokenVencido = true;
    ultimo_disparo = typeof dataPixel.last_fired_time === "string" ? dataPixel.last_fired_time : null;
  } catch {
    // sin último disparo esta vez no es crítico, sigue con lo demás
  }

  // /stats agrupa por hora y Meta solo deja ver hasta 7 días atrás desde
  // ahora -- no hace falta pedir una ventana, ya viene acotada así.
  let compras_7d = 0;
  let statsOk = false;
  try {
    let url: string | null =
      `https://graph.facebook.com/v21.0/${usuario.meta_pixel_id}/stats?aggregation=event&access_token=${usuario.meta_access_token}`;
    for (let pagina = 0; url && pagina < MAX_PAGINAS_STATS; pagina++) {
      const res: Response = await fetch(url);
      const data: any = await res.json();
      if (esErrorTokenMetaVencido(data.error)) tokenVencido = true;
      if (data.error) break;
      statsOk = true;
      for (const horaria of data.data || []) {
        for (const evento of horaria.data || []) {
          if (evento.value === EVENTO_COMPRA_PIXEL) compras_7d += evento.count || 0;
        }
      }
      url = data.paging?.next || null;
    }
  } catch {
    // se intenta el respaldo de insights abajo
  }

  let compraAtribuidaAAnuncios: { value: string } | undefined;
  let valorCompraAtribuida: { value: string } | undefined;
  if (usuario.meta_ad_account_id) {
    try {
      const resInsights = await fetch(
        `https://graph.facebook.com/v21.0/${usuario.meta_ad_account_id}/insights` +
          `?fields=actions,action_values&date_preset=last_7d&access_token=${usuario.meta_access_token}`
      );
      const dataInsights = await resInsights.json();
      if (esErrorTokenMetaVencido(dataInsights.error)) tokenVencido = true;
      const fila = dataInsights.data?.[0];
      if (fila) {
        compraAtribuidaAAnuncios = ACCIONES_COMPRA.map((t) => fila.actions?.find((a: any) => a.action_type === t)).find(Boolean);
        valorCompraAtribuida = ACCIONES_COMPRA.map((t) => fila.action_values?.find((a: any) => a.action_type === t)).find(Boolean);

        // Si /stats del pixel no respondió, los insights de la cuenta
        // sirven de respaldo para compras_7d (aunque esos solo ven lo
        // atribuido a anuncios, no lo orgánico).
        if (!statsOk && compraAtribuidaAAnuncios) {
          compras_7d = parseInt(compraAtribuidaAAnuncios.value, 10) || 0;
        }
      }
    } catch {
      // sin respaldo de insights, se sigue solo con lo que dio /stats
    }
  }

  // compras_con_valor: solo se puede confirmar con los insights de la
  // cuenta (atribuidos a anuncios) -- si hay compras pero ninguna está
  // atribuida a un anuncio en esta ventana (ej. son orgánicas, sin
  // pauta), queda "desconocido" (null), nunca "false" a secas.
  let compras_con_valor: boolean | null;
  if (compras_7d === 0) {
    compras_con_valor = false;
  } else if (compraAtribuidaAAnuncios) {
    compras_con_valor = !!valorCompraAtribuida && (parseFloat(valorCompraAtribuida.value) || 0) > 0;
  } else {
    compras_con_valor = null;
  }

  if (tokenVencido) {
    return { conectado: false, ultimo_disparo: null, compras_7d: 0, compras_con_valor: false };
  }

  return { conectado: true, ultimo_disparo, compras_7d, compras_con_valor };
}

// Mismo criterio que ya usaba app/metas/crear/page.tsx
// (saludPixel.conectado && saludPixel.compras_7d > 0), centralizado para
// no repetirlo en cada lugar que necesite la misma pregunta.
export function pixelListoParaVentas(salud: SaludPixel): boolean {
  return salud.conectado && salud.compras_7d > 0;
}
